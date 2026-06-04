// ------------------------------
// supa STATE
// ------------------------------

let currentUser = null;
let trainings = [];
let wordFiles = [];
let currentDate = new Date();

// ------------------------------
// INIT
// ------------------------------

async function init() {
  // Aktuellen User holen
  const { data: userData } = await supa.auth.getUser();
  currentUser = userData?.user || null;

  // Wenn kein User → zurück zum Login
  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  // Daten laden
  await loadTrainings();
  await loadWordFiles();

  // UI anpassen (Coach vs Athlet)
  const isCoach = currentUser.email === "coach@training.de";

  const importExcelBtn = document.getElementById("importExcel");
  const importDocsBtn = document.getElementById("importDocs");

  if (!isCoach) {
    if (importExcelBtn) importExcelBtn.style.display = "none";
    if (importDocsBtn) importDocsBtn.style.display = "none";
  }

  renderCalendar();
}

window.addEventListener("load", init);

// ------------------------------
// TRAININGS LADEN
// ------------------------------

async function loadTrainings() {
  const { data, error } = await supa
    .from("trainings")
    .select("*")
    .order("date", { ascending: true });

  trainings = data || [];
}

// ------------------------------
// WORD-DATEIEN LADEN
// ------------------------------

async function loadWordFiles() {
  const { data, error } = await supa
    .from("word_files")
    .select("*")
    .order("created_at", { ascending: true });

  wordFiles = data || [];
}

// ------------------------------
// KALENDER RENDERN
// ------------------------------

function renderCalendar() {
  const monthName = document.getElementById("monthName");
  const calendarGrid = document.getElementById("calendarGrid");

  const monthNames = [
    "Januar","Februar","März","April","Mai","Juni",
    "Juli","August","September","Oktober","November","Dezember"
  ];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  monthName.textContent = `${monthNames[month]} ${year}`;
  calendarGrid.innerHTML = "";

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  // Leere Felder vor dem 1. Tag
  for (let i = 0; i < offset; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.classList.add("calendar-day");
    emptyCell.style.opacity = "0.3";
    calendarGrid.appendChild(emptyCell);
  }

  // Tage einfügen
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.classList.add("calendar-day");

    const number = document.createElement("div");
    number.classList.add("calendar-day-number");
    number.textContent = day;
    cell.appendChild(number);

    const dateString = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const dayTrainings = trainings.filter(t => t.date === dateString);

    // ATHLETEN-TRAININGS
    dayTrainings.forEach(t => {
      if (t.athlete !== "Phase") {
        const label = document.createElement("div");
        label.classList.add("calendar-day-training");

        if (t.athlete === "Lasse") label.style.color = "#007aff";
        if (t.athlete === "Tora") label.style.color = "#34c759";
        if (t.athlete === "Kerstin") label.style.color = "#ff9500";

        const variantText = t.variant ? ` (${t.variant})` : "";
        label.textContent = `${t.athlete}: ${t.training}${variantText}`;
        cell.appendChild(label);
      }
    });

    // PHASE ANZEIGEN
    const phaseForDay = dayTrainings.find(t => t.athlete === "Phase");
    if (phaseForDay) {
      const phaseLabel = document.createElement("div");
      phaseLabel.classList.add("calendar-day-training");
      phaseLabel.style.marginTop = "4px";
      phaseLabel.style.fontWeight = "600";
      phaseLabel.style.color = "#8e8e93";
      phaseLabel.textContent = `Phase: ${phaseForDay.phase}`;
      cell.appendChild(phaseLabel);
    }

    // Popup öffnen
    cell.addEventListener("click", () => openDayPopup(dateString));

    calendarGrid.appendChild(cell);
  }
}

// ------------------------------
// POPUP
// ------------------------------

function openDayPopup(dateString) {
  const oldPopup = document.querySelector(".apple-popup-overlay");
  if (oldPopup) oldPopup.remove();

  const overlay = document.createElement("div");
  overlay.classList.add("apple-popup-overlay");

  const box = document.createElement("div");
  box.classList.add("apple-popup-box");

  const closeBtn = document.createElement("div");
  closeBtn.classList.add("apple-popup-close");
  closeBtn.textContent = "×";
  closeBtn.onclick = () => overlay.remove();

  const title = document.createElement("h3");
  title.textContent = `Training am ${dateString}`;

  const list = document.createElement("div");
  list.classList.add("apple-popup-content");

  const items = trainings.filter(t => t.date === dateString);

  if (items.length === 0) {
    list.textContent = "Keine Einträge.";
  } else {
    items.forEach(t => {
      const line = document.createElement("div");
      line.classList.add("apple-popup-line");

      if (t.athlete === "Phase") {
        line.innerHTML = `<strong>Phase:</strong> ${t.phase}`;
      } else {
        const variantText = t.variant ? ` (${t.variant})` : "";
        line.innerHTML = `<strong>${t.athlete}:</strong> ${t.training}${variantText}`;
      }

      list.appendChild(line);

      // PASSENDE WORD-DATEI SUCHEN
      const match = wordFiles.find(w =>
        (w.phase || "").toLowerCase() === (t.phase || "").toLowerCase() &&
        (w.variant || "").toLowerCase() === (t.variant || "").toLowerCase() &&
        (w.sport || "").toLowerCase() === (t.sport || "").toLowerCase()
      );

      if (match) {
        const { data } = supa
          .storage
          .from("training-docs")
          .getPublicUrl(match.file_path);

        const download = document.createElement("a");
        download.textContent = "📄 Trainingsplan herunterladen";
        download.href = data.publicUrl;
        download.download = match.file_path.split("/").pop();
        download.classList.add("download-link");
        list.appendChild(download);
      }
    });
  }

  box.appendChild(closeBtn);
  box.appendChild(title);
  box.appendChild(list);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add("visible");
    box.classList.add("visible");
  }, 10);
}

// ------------------------------
// MONATSWECHSEL
// ------------------------------

document.getElementById("prevMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

// ------------------------------
// EXCEL IMPORT → supa
// ------------------------------

document.getElementById("importExcel").addEventListener("click", () => {
  if (!currentUser || currentUser.email !== "coach@training.de") {
    alert("Nur der Coach darf den Kalender bearbeiten.");
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx";

  input.onchange = async (e) => {
    const file = e.target.files[0];
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);

    // Alte Einträge löschen (optional)
    await supa.from("trainings").delete().neq("id", 0);

    const inserts = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      rows.forEach(row => {
        // Datum
        let excelDate =
          row["Datum"] ||
          row["__EMPTY"] ||
          row["__EMPTY_1"];

        if (!excelDate) return;

        let jsDate;
        if (typeof excelDate === "number") {
          jsDate = XLSX.SSF.parse_date_code(excelDate);
        } else {
          const d = new Date(excelDate);
          if (!isNaN(d)) {
            jsDate = { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
          }
        }

        if (!jsDate) return;

        const dateString = `${jsDate.y}-${String(jsDate.m).padStart(2,"0")}-${String(jsDate.d).padStart(2,"0")}`;

        // PHASE
        const rawPhase = (row["Trainingsphase"] || "").trim();
        let phase = rawPhase.split("(")[0].trim();

        // VARIANTE + SPORT aus "konkretes Training"
        const rawDetail = (row["konkretes Training"] || "").trim();

        let variant = "";
        let sport = "";

        const variantMatch = rawDetail.match(/ChatGPT\s*\d+/i);
        if (variantMatch) variant = variantMatch[0];

        const sportPart = rawDetail.split(")").pop().trim();
        if (sportPart) sport = sportPart;

        // ATHLETEN
        ["Lasse","Tora","Kerstin"].forEach(name => {
          if (row[name] && row[name].trim() !== "") {
            inserts.push({
              date: dateString,
              athlete: name,
              training: row[name],
              phase: phase,
              variant: variant,
              sport: sport
            });
          }
        });

        // Phase-Eintrag
        inserts.push({
          date: dateString,
          athlete: "Phase",
          training: "",
          phase: phase,
          variant: variant,
          sport: sport
        });
      });
    });

    if (inserts.length > 0) {
      await supa.from("trainings").insert(inserts);
    }

    await loadTrainings();
    renderCalendar();
    alert("Excel erfolgreich importiert!");
  };

  input.click();
});

// ------------------------------
// WORD IMPORT → supa
// ------------------------------

document.getElementById("importDocs").addEventListener("click", () => {
  if (!currentUser || currentUser.email !== "coach@training.de") {
    alert("Nur der Coach darf Word-Dateien importieren.");
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".docx";
  input.multiple = true;

  input.onchange = async (e) => {
    const files = Array.from(e.target.files);

    const inserts = [];

    for (const file of files) {
      const name = file.name.replace(".docx", "").trim();

      // Beispiel: "Aufbau 2 (ChatGPT 3) Koppel"
      const phase = name.split("(")[0].trim();

      const variantMatch = name.match(/ChatGPT\s*\d+/i);
      const variant = variantMatch ? variantMatch[0] : "";

      const sport = name.split(")").pop().trim();

      const filePath = `${Date.now()}-${file.name}`;

      await supa.storage
        .from("training-docs")
        .upload(filePath, file);

      inserts.push({
        phase: phase,
        variant: variant,
        sport: sport.toLowerCase(),
        file_path: filePath
      });
    }

    if (inserts.length > 0) {
      await supa.from("word_files").insert(inserts);
    }

    await loadWordFiles();
    alert("Word-Dateien erfolgreich importiert!");
  };

  input.click();
});
