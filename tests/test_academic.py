import os
import tempfile
import unittest
from datetime import date

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

    def test_calendar_import_validates_dates_and_ignores_duplicates(self):
        event = {"date": "2026-12-25", "title": "Winter break", "type": "Holiday"}

        result = academic.import_events([event, event])

        self.assertEqual(result["imported"], 1)
        self.assertEqual(len(result["events"]), 1)
        with self.assertRaisesRegex(ValueError, "valid date"):
            academic.import_events([{"date": "not-a-date", "title": "Bad date"}])


if __name__ == "__main__":
    unittest.main()
