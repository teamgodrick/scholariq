import { fill, h, api, upload, head, card, field, btn, note, bar, bars } from "./ui.js";

export async function attendance(root) {
  const [allClasses, subjects, day] = await Promise.all([api("/timetable"), api("/attendance"), api("/lectures")]);
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const pickDay = h("select", {}, weekdays.map((name, i) => h("option", { value: iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)) }, name)));
  pickDay.value = day.date;
  const subject = h("input", { placeholder: "e.g. Data Structures" });
  const classDay = h("select", {}, weekdays.map((name) => h("option", { value: name }, name)));
  classDay.value = day.weekday;
  const start = h("input", { type: "time" }), end = h("input", { type: "time" });
  const location = h("input", { placeholder: "Room or location (optional)" });
  const classes = h("div");
  const weekly = h("div");
  const paintDay = async () => {
    const selected = await api(`/lectures?date=${encodeURIComponent(pickDay.value)}`);
    const visible = selected.classes.length ? selected.classes.map((c) => h("div", { class: "row later lecture" },
      h("div", { class: "grow" }, h("strong", {}, c.subject),
        h("span", { class: "muted small" }, `${c.start_time}–${c.end_time}${c.location ? " · " + c.location : ""}`)),
      c.status ? h("span", { class: "chip status-" + c.status }, c.status === "no_class" ? "No class" : c.status) :
        selected.today ? h("div", { class: "btns" }, ...[["Present", "present"], ["Absent", "absent"], ["No class", "no_class"]].map(([label, status]) =>
          btn(label, async () => { await api(`/lectures/${c.id}/mark`, { date: selected.date, status }); await paintDay(); }, "ghost"))) :
          h("span", { class: "muted small" }, "View only — attendance is marked on today’s schedule."))) :
      [note("No classes scheduled for this day. Add one to your timetable.")];
    fill(classes, ...visible);
  };
  await paintDay();
  const paintWeek = () => {
    const dayClasses = allClasses.filter((c) => c.day === weekdays.find((x) => x === classDay.value));
    fill(weekly, dayClasses.length ? dayClasses.map((c) => h("div", { class: "row later" },
      h("div", { class: "grow" }, h("strong", {}, c.subject),
        h("span", { class: "muted small" }, `${c.start_time}–${c.end_time}${c.location ? " · " + c.location : ""}`)),
      btn("Remove", async () => { await api(`/timetable/${c.id}/delete`, {}); attendance(root); }, "ghost danger"))) : note("No classes scheduled for this weekday."));
  };
  paintWeek();
  pickDay.addEventListener("change", paintDay);
  classDay.addEventListener("change", paintWeek);
  const addDay = h("select", {}, weekdays.map((name) => h("option", { value: name }, name)));
  const reportFile = h("input", { type: "file", accept: ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" });
  const reportPreview = h("div");
  const attendanceCards = subjects.length ? subjects.map((s) => {
    const remainingInput = h("input", { type: "number", min: 0, max: 10000, step: 1,
      value: s.remaining_classes == null ? "" : s.remaining_classes, placeholder: "Enter remaining classes" });
    const target = s.remaining_classes == null
      ? note("Enter how many classes remain to calculate your semester skip allowance.")
      : s.extra_classes_needed > 0
        ? h("p", { class: "bad" }, `Even attending all ${s.remaining_classes} remaining classes projects ${s.projected_pct}%. You would need ${s.extra_classes_needed} additional attended class(es) to reach 75%.`)
        : s.semester_can_skip > 0
          ? h("p", { class: "good" }, `You can miss up to ${s.semester_can_skip} of your ${s.remaining_classes} remaining classes and still finish at 75% or higher (if you attend the rest).`)
          : h("p", {}, `Attend all ${s.remaining_classes} remaining classes to finish at ${s.projected_pct}%. No safe skips remain.`);
    return card(null,
      h("div", { class: "btns", style: "justify-content:space-between" },
        h("strong", {}, s.name), h("span", { class: s.pct < 75 ? "bad" : "good" }, `${s.pct}% currently`)),
      bar(s.pct, s.pct < 75 ? "red" : ""),
      h("p", { class: "small muted" }, `${s.attended} of ${s.total} classes attended`),
      target,
      field("Classes remaining this semester", remainingInput),
      btn("Save remaining classes", async () => {
        await api("/attendance/remaining", { name: s.name, remaining_classes: remainingInput.value });
        attendance(root);
      }));
  }) : [card(null, note("No subject attendance yet. Upload your current attendance report to get started."))];
  const importCard = card("Import current attendance", field("Attendance report PDF or image", reportFile),
    note("The report is processed on this laptop with offline OCR—no LM Studio or cloud upload is needed. Check and correct every extracted value before importing."),
    btn("Read attendance report", async () => {
      const selected = reportFile.files[0];
      if (!selected) throw new Error("Choose an attendance report first.");
      const result = await upload(`/attendance/extract?name=${encodeURIComponent(selected.name)}`, selected);
      const rows = [];
      const rowList = h("div");
      const addRow = (subjectRow = {}) => {
        const include = h("input", { type: "checkbox", checked: true });
        const name = h("input", { value: subjectRow.name || "", maxlength: 60, placeholder: "Check subject name",
          class: subjectRow.name ? "" : "uncertain-field" });
        const attended = h("input", { type: "number", min: 0, step: 1,
          class: subjectRow.attended == null ? "uncertain-field" : "",
          value: subjectRow.attended == null ? "" : subjectRow.attended, placeholder: "Check count" });
        const total = h("input", { type: "number", min: 0, step: 1,
          class: subjectRow.total == null ? "uncertain-field" : "",
          value: subjectRow.total == null ? "" : subjectRow.total, placeholder: "Check count" });
        const remaining = h("input", { type: "number", min: 0, max: 10000, step: 1,
          value: subjectRow.remaining_classes == null ? "" : subjectRow.remaining_classes, placeholder: "Optional" });
        const warning = note("Some details were unclear. Check and fill the highlighted fields before saving.");
        const record = { include, name, attended, total, remaining,
          row: h("div", { class: "attendance-import-row" },
            h("label", { class: "check" }, include, "Import"),
            field("Subject", name), field("Attended", attended),
            field("Total so far", total), field("Remaining this semester", remaining),
            warning) };
        const validCount = (input, max = 1000000) =>
          input.value === "" || (Number.isInteger(Number(input.value)) && Number(input.value) >= 0 && Number(input.value) <= max);
        const updateWarning = () => {
          const invalidPair = !validCount(attended) || !validCount(total) ||
            (attended.value !== "" && total.value !== "" && Number(attended.value) > Number(total.value));
          name.classList.toggle("uncertain-field", !name.value.trim());
          attended.classList.toggle("uncertain-field", invalidPair || attended.value === "");
          total.classList.toggle("uncertain-field", invalidPair || total.value === "");
          remaining.classList.toggle("uncertain-field", !validCount(remaining, 10000));
          const incomplete = !name.value.trim() || invalidPair || attended.value === "" || total.value === "" ||
            !validCount(remaining, 10000);
          warning.hidden = !incomplete;
          record.row.classList.toggle("incomplete", incomplete);
        };
        [name, attended, total, remaining].forEach((input) => input.addEventListener("input", updateWarning));
        updateWarning();
        rows.push(record);
        rowList.append(record.row);
        return record;
      };
      result.subjects.forEach(addRow);
      fill(reportPreview, h("p", { class: "small muted" }, "Review and correct the OCR results before importing. If rows were not detected, add them from the recognized text below."),
        h("details", { class: "ocr-details" }, h("summary", {}, "Show recognized text"), h("pre", { class: "ocr-text" }, result.text || "No text detected.")),
        rowList,
        btn("Add a subject", () => { addRow(); rows[rows.length - 1].name.focus(); }, "ghost"),
        btn("Save selected attendance", async () => {
          const picked = rows.filter((row) => row.include.checked).map((row) => ({
            name: row.name.value, attended: row.attended.value, total: row.total.value,
            remaining_classes: row.remaining.value === "" ? null : row.remaining.value,
          }));
          if (!picked.length) throw new Error("Select at least one subject to import.");
          await api("/attendance/snapshot", { subjects: picked });
          attendance(root);
        }));
    }), reportPreview);
  fill(root, head("Attendance & timetable", "Track each scheduled lecture once, or browse your weekly timetable."),
    card("Classes for " + day.weekday, field("View day", pickDay), classes),
    h("div", { class: "cols" },
      card("Weekly timetable", field("Day", classDay), weekly),
      card("Add a class", field("Subject", subject), field("Weekday", addDay),
        h("div", { class: "two" }, field("Start time", start), field("End time", end)), field("Room or location", location),
        btn("Add to timetable", async () => {
          await api("/timetable", { subject: subject.value, day: addDay.value, start_time: start.value, end_time: end.value, location: location.value });
          attendance(root);
        }))),
    h("div", { class: "cols" },
      card("Semester attendance", note("Your semester skip allowance assumes you attend every other remaining class. “No class” marks do not count."),
        ...attendanceCards),
      importCard));
}

export async function calendar(root) {
  const events = await api("/calendar/events");
  const file = h("input", { type: "file", accept: ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" });
  const preview = h("div");
  fill(root, head("Academic calendar", "Upload your academic calendar PDF or image. Review the extracted dates before importing."),
    h("div", { class: "cols" },
      card("Import from a PDF or image", field("Calendar file", file),
        note("Text PDFs work directly. For scanned PDFs, upload a clear image. Select a Vision model in Settings before importing images; files stay on this laptop."),
        btn("Read calendar", async () => {
          const selected = file.files[0];
          if (!selected) throw new Error("Choose a calendar PDF or image first.");
          const result = await upload(`/calendar/import?name=${encodeURIComponent(selected.name)}`, selected);
          const checked = result.events.map((event) => {
            const include = h("input", { type: "checkbox", checked: true });
            const eventDate = h("input", { type: "date", value: event.date });
            const title = h("input", { value: event.title, maxlength: 120 });
            const type = h("input", { value: event.type || "Event", maxlength: 40 });
            return { event, include, eventDate, title, type,
              row: h("div", { class: "calendar-preview-row" }, h("label", { class: "check" }, include, "Import"),
                field("Date", eventDate), field("Event", title), field("Type", type)) };
          });
          fill(preview, checked.map((item) => item.row),
            btn("Import selected events", async () => {
              const picked = checked.filter((item) => item.include.checked).map((item) => ({
                ...item.event, date: item.eventDate.value, title: item.title.value, type: item.type.value,
              }));
              if (!picked.length) throw new Error("Select at least one event to import.");
              await api("/calendar/events/import", { events: picked });
              calendar(root);
            }));
        }), preview),
      card("Holidays & events", events.length ? events.map((event) => h("div", { class: "row later" },
        h("div", { class: "grow" }, h("strong", {}, event.title),
          h("span", { class: "muted small" }, `${event.event_date} · ${event.event_type}${event.description ? " · " + event.description : ""}`)),
        btn("Remove", async () => { await api(`/calendar/events/${event.id}/delete`, {}); calendar(root); }, "ghost danger"))) :
        note("No imported events yet."))));
}

export async function budget(root) {
  const b = await api("/budget");
  const limit = h("input", { type: "number", min: 0, value: b.limit || "" }), cat = h("select", {}, ["Food", "Transport", "Study", "Fun", "Recharge", "Other"].map((c) => h("option", { value: c }, c)));
  const amt = h("input", { type: "number", min: 0, placeholder: "Amount in rupees" }), nt = h("input", { placeholder: "Note (optional)" });
  const max = Math.max(1, ...Object.values(b.by_category));
  fill(root, head("Hostel budget", "Know what you can safely spend each day this month."),
    h("div", { class: "stats" }, [["Monthly limit", "Rs " + b.limit], ["Spent", "Rs " + b.spent], ["Remaining", "Rs " + b.remaining], ["Safe per day", "Rs " + b.safe_daily]].map(([l, v]) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, l)))),
    h("div", { class: "cols" },
      h("div", {}, card("Spending by category", Object.keys(b.by_category).length ? Object.entries(b.by_category).map(([c, v]) => h("div", {}, h("p", { class: "small" }, `${c}: Rs ${v}`), bar((v / max) * 100))) : note("No expenses this month.")),
        card("Recent expenses", b.recent.length ? h("ul", { class: "list" }, b.recent.map((e) => h("li", { class: "row later" }, h("div", { class: "grow" }, h("strong", {}, `Rs ${e.amount} ${e.category}`), h("span", { class: "muted small" }, `${e.day} ${e.note || ""}`)),
          btn("Delete", async () => { await api(`/expenses/${e.id}/delete`, {}); budget(root); }, "ghost danger")))) : note("Nothing yet."))),
      h("div", {}, card("Set monthly budget", field("Amount (Rs)", limit), btn("Save budget", async () => { await api("/budget/limit", { amount: Number(limit.value) }); budget(root); })),
        card("Add an expense", field("Category", cat), field("Amount", amt), field("Note", nt), btn("Add expense", async () => { await api("/budget/expense", { category: cat.value, amount: Number(amt.value), note: nt.value }); budget(root); })))));
}

export async function placement(root) {
  const cats = await api("/prep");
  const catIn = h("input", { placeholder: "Category, e.g. DSA" }), title = h("input", { placeholder: "What to prepare" });
  fill(root, head("Placement prep", "A checklist for DSA, aptitude, CS core and career basics."),
    !cats.length ? card(null, note("Start with a ready-made checklist, then edit it."), btn("Add starter checklist", async () => { await api("/prep/starter", {}); placement(root); })) : null,
    h("div", { class: "cols" },
      h("div", {}, cats.map((c) => card(`${c.category}: ${c.pct}% done`, bar(c.pct), h("ul", { class: "list" }, c.items.map((i) => h("li", { class: "row later" },
        h("div", { class: "grow" }, h("span", { style: i.done ? "text-decoration:line-through;opacity:.6" : "" }, i.title)),
        btn(i.done ? "Undo" : "Done", async () => { await api(`/prep/${i.id}/toggle`, {}); placement(root); }, i.done ? "ghost on" : "ghost"),
        btn("x", async () => { await api(`/prep/${i.id}/delete`, {}); placement(root); }, "ghost danger"))))))),
      card("Add an item", field("Category", catIn), field("Topic", title), btn("Add", async () => { await api("/prep", { category: catIn.value, title: title.value }); placement(root); }))));
}
