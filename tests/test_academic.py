import os
import tempfile
import unittest
from datetime import date
from unittest.mock import patch

import academic
import db
import life


class AcademicTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handle, cls.db_path = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        db.PATH = cls.db_path
        db.init()

    @classmethod
    def tearDownClass(cls):
        os.remove(cls.db_path)

    def setUp(self):
        db.run("DELETE FROM lecture_attendance")
        db.run("DELETE FROM timetable")
        db.run("DELETE FROM academic_events")
        db.run("DELETE FROM subjects")

    def test_lecture_can_only_be_marked_once_per_class_and_day(self):
        weekday = date.today().strftime("%A")
        class_id = academic.timetable_add("Databases", weekday, "09:00", "10:00")

        academic.mark_lecture(class_id, db.today(), "present")

        with self.assertRaisesRegex(ValueError, "already has a status"):
            academic.mark_lecture(class_id, db.today(), "absent")
        self.assertEqual(academic.lectures_for_day()["classes"][0]["status"], "present")

    def test_only_today_can_be_marked_and_no_class_is_a_valid_status(self):
        weekday = date.today().strftime("%A")
        class_id = academic.timetable_add("Networks", weekday, "11:00", "12:00")

        with self.assertRaisesRegex(ValueError, "only be marked for today"):
            academic.mark_lecture(class_id, "2000-01-01", "present")
        academic.mark_lecture(class_id, db.today(), "no_class")
        self.assertEqual(academic.lectures_for_day()["classes"][0]["status"], "no_class")

    def test_attendance_totals_include_present_and_absent_but_ignore_no_class(self):
        weekday = date.today().strftime("%A")
        for start, status in (("09:00", "present"), ("10:00", "absent"), ("11:00", "no_class")):
            class_id = academic.timetable_add("Databases", weekday, start, "12:00")
            academic.mark_lecture(class_id, db.today(), status)

        summary = life.attendance_list()[0]

        self.assertEqual((summary["attended"], summary["total"]), (1, 2))
        self.assertEqual(summary["pct"], 50.0)

    def test_semester_skip_allowance_accounts_for_all_remaining_classes(self):
        good = life._subject({"name": "Databases", "attended": 18, "total": 24, "remaining_classes": 12})
        low = life._subject({"name": "Networks", "attended": 6, "total": 10, "remaining_classes": 2})

        self.assertEqual(good["semester_can_skip"], 3)
        self.assertEqual(good["projected_pct"], 83.3)
        self.assertEqual(low["semester_can_skip"], 0)
        self.assertEqual(low["projected_pct"], 66.7)
        self.assertEqual(low["extra_classes_needed"], 4)

    def test_remaining_classes_decrease_for_held_classes_only(self):
        subject_id = db.run(
            "INSERT INTO subjects(name,attended,total,remaining_classes) VALUES(?,?,?,?)",
            ("Databases", 10, 12, 8))
        weekday = date.today().strftime("%A")
        present_id = academic.timetable_add("Databases", weekday, "09:00", "10:00")
        no_class_id = academic.timetable_add("Databases", weekday, "10:00", "11:00")

        academic.mark_lecture(present_id, db.today(), "present")
        academic.mark_lecture(no_class_id, db.today(), "no_class")

        self.assertEqual(db.one("SELECT remaining_classes FROM subjects WHERE id=?", (subject_id,))["remaining_classes"], 7)

    def test_snapshot_import_keeps_local_lecture_marks_synced(self):
        weekday = date.today().strftime("%A")
        class_id = academic.timetable_add("Databases", weekday, "09:00", "10:00")
        academic.mark_lecture(class_id, db.today(), "present")

        result = life.import_attendance_snapshot([{
            "name": "Databases", "attended": 8, "total": 10, "remaining_classes": 5,
        }])

        self.assertEqual((result[0]["attended"], result[0]["total"]), (8, 10))
        self.assertEqual(result[0]["remaining_classes"], 5)

    def test_image_extraction_returns_reviewable_values_without_saving_them(self):
        image = b"\x89PNG\r\n\x1a\nplaceholder"
        with patch.object(life.ocr, "read_image_lines", return_value=["Subject Attended Total", "Databases 8 10"]):
            preview = life.extract_attendance_snapshot("report.png", image)

        self.assertEqual(preview["subjects"][0]["attended"], 8)
        self.assertIn("Offline OCR", preview["source"])
        self.assertEqual(life.attendance_list(), [])

    def test_unclear_image_counts_are_returned_for_manual_review(self):
        image = b"\x89PNG\r\n\x1a\nplaceholder"
        with patch.object(life.ocr, "read_image_lines", return_value=["Databases unclear 10"]):
            preview = life.extract_attendance_snapshot("report.png", image)

        self.assertIsNone(preview["subjects"][0]["attended"])
        self.assertIsNone(preview["subjects"][0]["total"])
        with self.assertRaisesRegex(ValueError, "whole number"):
            life.import_attendance_snapshot(preview["subjects"])
        self.assertEqual(life.attendance_list(), [])

    def test_ocr_parser_leaves_ambiguous_extra_columns_for_review(self):
        rows = life._attendance_rows("Subject  Attended  Total\nDatabases  8  10\nPhysics  2  6  4")

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["name"], "Databases")
        self.assertEqual((rows[0]["attended"], rows[0]["total"]), (8, 10))
        self.assertIsNone(rows[1]["attended"])
        self.assertIsNone(rows[1]["total"])

    def test_scanned_pdf_images_use_local_ocr(self):
        image = b"embedded image"

        def fake_read_pdf(data, describe):
            return [("Page 1", describe(image, "image/png"))]

        with patch.object(life.readers, "read_pdf", side_effect=fake_read_pdf), \
             patch.object(life.ocr, "read_image_lines", return_value=["Physics 5 7"]):
            preview = life.extract_attendance_snapshot("report.pdf", b"%PDF-1.4 placeholder")

        self.assertEqual((preview["subjects"][0]["attended"], preview["subjects"][0]["total"]), (5, 7))

    def test_calendar_import_validates_dates_and_ignores_duplicates(self):
        event = {"date": "2026-12-25", "title": "Winter break", "type": "Holiday"}

        result = academic.import_events([event, event])

        self.assertEqual(result["imported"], 1)
        self.assertEqual(len(result["events"]), 1)
        with self.assertRaisesRegex(ValueError, "valid date"):
            academic.import_events([{"date": "not-a-date", "title": "Bad date"}])


if __name__ == "__main__":
    unittest.main()
