// ------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------
let currentUser = null;
let trainings = [];
let wordFiles = [];
let currentDate = new Date();

// WICHTIG: globale Flags
let isCoach = false;
let currentAthleteName = null;


// ------------------------------------------------------
// ZEITFORMATIERUNG
// ------------------------------------------------------
function formatSeconds(sec) {
  if (sec === null || sec === undefined) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}





// ------------------------------------------------------
// TRAININGS LADEN
// ------------------------------------------------------
let allTrainings = [];



async function loadTrainings() {
  const { data, error } = await supa
    .from("trainings")
    .select("*")
    .order("date", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  allTrainings = data;  // <-- WICHTIG!!!
  console.log("Trainings geladen:", allTrainings.length);
}
function formatExcelDate(value) {
  if (!value) return null;

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }

  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d)) {
      return d.toISOString().split("T")[0];
    }
  }

  return null;
}


// ------------------------------------------------------
// WORD-DATEIEN LADEN
// ------------------------------------------------------
async function loadWordFiles() {
  const { data } = await supa
    .from("word_files")
    .select("*")
    .order("created_at", { ascending: true });

  wordFiles = data || [];
}


// ------------------------------------------------------
// ATHLETENNAME AUS EMAIL
// ------------------------------------------------------
function getAthleteNameFromEmail(email) {
  if (!email) return null;
  const lower = email.toLowerCase();
  if (lower.startsWith("lasse")) return "Lasse";
  if (lower.startsWith("tora")) return "Tora";
  if (lower.startsWith("kerstin")) return "Kerstin";
  return null;
}


// ------------------------------------------------------
// KALENDER RENDERN
// ------------------------------------------------------
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

  for (let i = 0; i < offset; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.classList.add("calendar-day");
    emptyCell.style.opacity = "0.3";
    calendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.classList.add("calendar-day");

    const number = document.createElement("div");
    number.classList.add("calendar-day-number");
    number.textContent = day;
    cell.appendChild(number);

    const dateString = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const dayTrainings = allTrainings.filter(t => t.date === dateString);

      const visibleTrainings = isCoach
  ? dayTrainings
  : dayTrainings.filter(t =>
      t.athlete &&
      t.athlete.trim().toLowerCase() === currentAthleteName.trim().toLowerCase() ||
      t.athlete === "Phase"
    );



    visibleTrainings.forEach(t => {
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

    const phaseForDay = visibleTrainings.find(t => t.athlete === "Phase");
    if (phaseForDay) {
      const phaseLabel = document.createElement("div");
      phaseLabel.classList.add("calendar-day-training");
      phaseLabel.style.marginTop = "4px";
      phaseLabel.style.fontWeight = "600";
      phaseLabel.style.color = "#8e8e93";
      phaseLabel.textContent = `Phase: ${phaseForDay.phase}`;
      cell.appendChild(phaseLabel);
    }

    cell.addEventListener("click", () => openDayPopup(dateString));
    calendarGrid.appendChild(cell);
  }
}
// ------------------------------------------------------
// COACH: NEUEN ATHLETEN ERSTELLEN + TRAININGS KOPIEREN
// ------------------------------------------------------

document.getElementById("createUserSubmit").onclick = async () => {
  const email = document.getElementById("newUserEmail").value;
  const password = document.getElementById("newUserPassword").value;
  const sourceAthlete = document.getElementById("newUserSource").value;
  const newAthleteName = document.getElementById("newUserAthleteName").value;

  if (!email || !password || !newAthleteName) {
    alert("Bitte Email, Passwort und neuen Athletennamen eingeben.");
    return;
  }

  // 1. Benutzer erstellen
  const { data, error } = await supa.auth.signUp({
    email: email,
    password: password,
    options: {
      email_confirm: true
    }
  });

  if (error) {
    console.error(error);
    alert("Fehler beim Erstellen des Benutzers.");
    return;
  }

  const newUserId = data.user.id;

  // 2. Profil speichern
  await supa.from("profiles").insert({
    id: newUserId,
    email: email,
    athlete_name: newAthleteName
  });

  // 3. Trainings vom Quellathleten kopieren
  const { data: sourceTrainings } = await supa
    .from("trainings")
    .select("*")
    .eq("athlete", sourceAthlete);

  if (sourceTrainings && sourceTrainings.length > 0) {
    const copied = sourceTrainings.map(t => ({
      date: t.date,
      athlete: newAthleteName,
      training: t.training,
      phase: t.phase,
      variant: t.variant,
      sport: t.sport
    }));

    await supa.from("trainings").insert(copied);
  }

  alert("Athlet erfolgreich erstellt! Trainings wurden übernommen.");
};

document.getElementById("deleteAthleteBtn").onclick = async () => {
  const name = prompt("Welchen Athleten möchtest du löschen? (Name genau eingeben)");

  if (!name) return;

  if (!confirm(`Soll der Athlet "${name}" wirklich gelöscht werden?`)) return;

  await deleteAthlete(name);
};
async function deleteAthlete(name) {
  // 1. Trainings löschen
  const { error: tError } = await supa
    .from("trainings")
    .delete()
    .eq("athlete", name);

  if (tError) {
    console.error(tError);
    alert("Fehler beim Löschen der Trainings.");
    return;
  }

  // 2. Profil löschen
  const { error: pError } = await supa
    .from("profiles")
    .delete()
    .eq("athlete_name", name);

  if (pError) {
    console.error(pError);
    alert("Fehler beim Löschen des Profils.");
    return;
  }

  alert(`Athlet "${name}" wurde erfolgreich gelöscht.`);

  await loadTrainings();
  renderCalendar();
}




// ------------------------------------------------------
// WICHTIG: INIT STARTEN
// ------------------------------------------------------
window.addEventListener("load", init);


// ------------------------------------------------------
// POPUP – TRAININGSTAG (ATHLET + PLAN + PRO-ANALYSE)
// ------------------------------------------------------

async function openDayPopup(dateString) {
  

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

  const allItems = allTrainings.filter(t => t.date === dateString);

  const items = isCoach
  ? allItems
  : allItems.filter(t =>
      t.athlete &&
      t.athlete.trim().toLowerCase() === currentAthleteName.trim().toLowerCase() ||
      t.athlete === "Phase"
    );

  // ------------------------------------------------------
  // TRAININGSPLAN ANZEIGEN
  // ------------------------------------------------------

  if (items.length === 0) {
    list.textContent = "Keine Einträge.";
  } else {
    items.forEach(t => {
      const parsed = parseTraining(t.training);

      t.sport = parsed.sport;
      t.variant = parsed.variant;
      t.phase = parsed.phase || t.phase; // Phase aus Excel bleibt fallback
      t.cleanTraining = parsed.clean;

      // VARIANTE AUTOMATISCH ERKENNEN
      const detectVariant = (str) => {
        const match = str.match(/\((.*?)\)/);
        return match ? match[1].trim() : "";
      };

      t.variant = detectVariant(t.training);

      // SPORT AUTOMATISCH ERKENNEN
      const detectSport = (str) => {
        const s = str.toLowerCase();
        if (s.includes("lauf")) return "lauf";
        if (s.includes("schwimm")) return "schwimmen";
        if (s.includes("rad")) return "rad";
        if (s.includes("koppel")) return "koppel";
        return "";
      };

      t.sport = detectSport(t.training);

      const line = document.createElement("div");
      line.classList.add("apple-popup-line");

      if (t.athlete === "Phase") {
        line.innerHTML = `<strong>Phase:</strong> ${t.phase}`;
      } else {
        const variantText = t.variant ? ` (${t.variant})` : "";
        line.innerHTML = `<strong>${t.athlete}:</strong> ${t.training}${variantText}`;
      }

      list.appendChild(line);

      // ------------------------------------------------------
      // WORD-DATEI MATCHING
      // ------------------------------------------------------
      // TRAINING PARSER
      function parseTraining(str) {
        const result = {
          phase: "",
          variant: "",
          sport: "",
          clean: str
        };

        if (!str) return result;

        const lower = str.toLowerCase();

        // Phase erkennen (Aufbau 1, Aufbau 2, Grundlagen 1, etc.)
        const phaseMatch = lower.match(/(aufbau|grundlagen|höchst|wettkampf)\s*\d*/);
        if (phaseMatch) {
          result.phase = phaseMatch[0].replace(/\s+/g, "");
        }

        // Variante erkennen (ChatGPT 1, ChatGPT 2, ChatGPT 4…)
        const variantMatch = lower.match(/chatgpt\s*\d+/);
        if (variantMatch) {
          result.variant = variantMatch[0].replace(/\s+/g, "");
        }

        // Sport erkennen
        if (lower.includes("schwimm")) result.sport = "schwimmen";
        if (lower.includes("lauf")) result.sport = "laufen";
        if (lower.includes("rad")) result.sport = "rad";

        // Clean Training (alles ohne Klammern)
        result.clean = str.replace(/\(.*?\)/g, "").trim();

        return result;
      }

      let downloadAdded = false;

wordFiles.forEach(w => {
  if (downloadAdded) return;
  if ((t.athlete || "").toLowerCase() === "phase") return;

  const normalize = (str) =>
    (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");

  // Training parsen
  const parsed = parseTraining(t.training);

  const trainingPhase = normalize(parsed.phase || t.phase);
  const trainingSport = normalize(parsed.sport);
  const trainingVariant = normalize(parsed.variant);

  const wordPhase = normalize(w.phase);
  const wordSport = normalize(w.sport);
  const wordVariant = normalize(w.variant);

  const phaseMatch = trainingPhase === wordPhase;
  const sportMatch = trainingSport === wordSport;
  const variantMatch = trainingVariant === wordVariant;

  if (phaseMatch && sportMatch && variantMatch) {
    const { data } = supa.storage
      .from("training-docs")
      .getPublicUrl(w.file_path);

    const download = document.createElement("a");
    download.textContent = "Trainingsplan herunterladen";
    download.href = data.publicUrl;
    download.download = w.file_path.split("/").pop();
    download.classList.add("download-link");

    list.appendChild(download);
    downloadAdded = true;
  }
});

    });
    

  }

  // ------------------------------------------------------
  // ATHLETEN – ZEITEN EINTRAGEN + PRO-ANALYSE
  // ------------------------------------------------------

  if (currentUser.email !== "coach@training.de") {

    const divider = document.createElement("hr");
    divider.style.margin = "15px 0";
    list.appendChild(divider);

    const label = document.createElement("div");
    label.textContent = "Training eintragen:";
    label.style.marginBottom = "6px";
    list.appendChild(label);

    const intervalContainer = document.createElement("div");
    intervalContainer.id = "intervalContainer";
    list.appendChild(intervalContainer);

    const sport = items[0]?.sport || "unbekannt";
    const athlete = getAthleteNameFromEmail(currentUser.email);

    // ------------------------------------------------------
    // BEREITS GESPEICHERTE INTERVALLE LADEN
    // ------------------------------------------------------

    const { data: existingTimes } = await supa
      .from("training_times")
      .select("*")
      .eq("date", dateString)
      .eq("athlete", athlete)
      .order("interval_index", { ascending: true });

    if (existingTimes && existingTimes.length > 0) {

      const existingLabel = document.createElement("div");
      existingLabel.textContent = "Deine bisherigen Intervalle:";
      existingLabel.style.margin = "10px 0 6px 0";
      existingLabel.style.fontWeight = "600";
      list.appendChild(existingLabel);

      let durations = [];
      let paces = [];

      existingTimes.forEach(t => {
        const block = document.createElement("div");
        block.style.padding = "8px";
        block.style.border = "1px solid #ddd";
        block.style.borderRadius = "8px";
        block.style.marginBottom = "6px";

        let html = `<strong>Intervall ${t.interval_index}</strong><br>`;

        if (t.sport === "schwimmen") {
          html += `Distanz: ${t.distance_meters ?? "-"} m<br>`;
          html += `Zeit: ${formatSeconds(t.duration_seconds)}<br>`;
          durations.push(t.duration_seconds);
        }

        if (t.sport === "lauf") {
          html += `Dauer: ${formatSeconds(t.duration_seconds)}<br>`;
          html += `Pace: ${formatSeconds(t.pace_seconds_per_km)} / km<br>`;
          durations.push(t.duration_seconds);
          paces.push(t.pace_seconds_per_km);
        }

        if (t.sport === "rad") {
          html += `Dauer: ${formatSeconds(t.duration_seconds)}<br>`;
          html += `Distanz: ${t.distance_meters ?? "-"} m<br>`;
          if (athlete === "Lasse" || athlete === "Kerstin") {
            html += `Watt: ${t.watt ?? "-"}<br>`;
          }
          if (athlete === "Tora") {
            html += `Puls: ${t.heartrate ?? "-"}<br>`;
          }
          durations.push(t.duration_seconds);
        }

        block.innerHTML = html;

        // ------------------------------------------------------
        // LÖSCHEN-BUTTON
        // ------------------------------------------------------

        const del = document.createElement("button");
        del.textContent = "🗑️ löschen";
        del.style.marginTop = "6px";
        del.style.background = "#007aff";
        del.style.color = "white";
        del.style.border = "none";
        del.style.padding = "6px 10px";
        del.style.borderRadius = "6px";
        del.style.cursor = "pointer";

        const deleteId = t.id;

        del.onclick = async () => {
          const { error } = await supa
            .from("training_times")
            .delete()
            .eq("id", deleteId);

          if (error) {
            console.error(error);
            alert("Fehler beim Löschen!");
            return;
          }

          alert("Intervall gelöscht!");
          overlay.remove();
          openDayPopup(dateString);
        };

        block.appendChild(del);
        list.appendChild(block);
      });

      // ------------------------------------------------------
      // ANALYSE
      // ------------------------------------------------------

      function avg(arr) {
        return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      }

      function best(arr) {
        return arr.length ? Math.min(...arr) : null;
      }

      const avgDuration = avg(durations);
      const bestDuration = best(durations);
      const avgPace = avg(paces);
      const bestPace = best(paces);

      const analysis = document.createElement("div");
      analysis.style.padding = "10px";
      analysis.style.border = "2px solid #007aff";
      analysis.style.borderRadius = "10px";
      analysis.style.margin = "15px 0";
      analysis.style.background = "#f0f7ff";

      let analysisHTML = `<h4>Analyse</h4>`;

      if (durations.length > 0) {
        analysisHTML += `
          Durchschnittszeit: <strong>${formatSeconds(Math.round(avgDuration))}</strong><br>
          Beste Zeit: <strong>${formatSeconds(bestDuration)}</strong><br>
        `;
      }

      if (paces.length > 0) {
        analysisHTML += `
          Durchschnittspace: <strong>${formatSeconds(Math.round(avgPace))} / km</strong><br>
          Beste Pace: <strong>${formatSeconds(bestPace)} / km</strong><br>
        `;
      }

      let comment = "";
      if (durations.length >= 3) {
        const drift = durations[durations.length - 1] - durations[0];
        if (drift < 3) comment = "Sehr konstant! Du hast das Training super durchgezogen.";
        else if (drift < 8) comment = "Gute Leistung, leichte Ermüdung sichtbar.";
        else comment = "Du bist stark gestartet, aber hinten raus müde geworden.";
      }

      if (comment) analysisHTML += `<br><em>${comment}</em>`;

      analysis.innerHTML = analysisHTML;
      list.appendChild(analysis);

      const divider2 = document.createElement("hr");
      divider2.style.margin = "15px 0";
      list.appendChild(divider2);
    }

    // ------------------------------------------------------
    // FORMULAR FÜR NEUE INTERVALLE
    // ------------------------------------------------------

    function createIntervalForm(index) {
      const wrapper = document.createElement("div");
      wrapper.classList.add("interval-block");
      wrapper.style.padding = "10px";
      wrapper.style.border = "1px solid #ccc";
      wrapper.style.borderRadius = "10px";
      wrapper.style.marginBottom = "10px";

      let html = `<h4>Intervall ${index}</h4>`;

      if (sport === "schwimmen") {
        html += `
          <label>Distanz (m):</label>
          <input class="distanceInput" type="number" placeholder="100">

          <label>Zeit:</label>
          <input class="timeInput" type="text" placeholder="1:12">
        `;
      }

      if (sport === "lauf") {
        html += `
          <label>Dauer (Sekunden):</label>
          <input class="durationInput" type="number" placeholder="180">

          <label>Pace (min/km):</label>
          <input class="paceInput" type="text" placeholder="4:35">
        `;
      }

      if (sport === "rad") {
        html += `
          <label>Dauer (Sekunden):</label>
          <input class="durationInput" type="number" placeholder="180">

          <label>Distanz (optional, m):</label>
          <input class="distanceInput" type="number" placeholder="1000">
        `;

        if (athlete === "Lasse" || athlete === "Kerstin") {
          html += `
            <label>Watt:</label>
            <input class="wattInput" type="number" placeholder="220">
          `;
        }

        if (athlete === "Tora") {
          html += `
            <label>Puls:</label>
            <input class="heartrateInput" type="number" placeholder="145">
          `;
        }
      }

      wrapper.innerHTML = html;
      return wrapper;
    }

    let intervalCount = 1;
    intervalContainer.appendChild(createIntervalForm(intervalCount));

    const addIntervalBtn = document.createElement("button");
    addIntervalBtn.textContent = "+ Intervall hinzufügen";
    addIntervalBtn.classList.add("modern-btn");
    addIntervalBtn.style.width = "100%";
    addIntervalBtn.style.marginBottom = "10px";

    addIntervalBtn.onclick = () => {
      intervalCount++;
      intervalContainer.appendChild(createIntervalForm(intervalCount));
    };

    list.appendChild(addIntervalBtn);

    // ------------------------------------------------------
    // TRAINING NICHT GEMACHT
    // ------------------------------------------------------

    const notDoneBtn = document.createElement("button");
    notDoneBtn.textContent = "Training NICHT gemacht";
    notDoneBtn.classList.add("modern-btn");
    notDoneBtn.style.width = "100%";
    notDoneBtn.style.background = "#007aff";

    notDoneBtn.onclick = async () => {
      await supa.from("training_status").insert({
        date: dateString,
        athlete: athlete,
        sport: sport,
        status: "not_done"
      });

      alert("Training als NICHT gemacht markiert.");
      overlay.remove();
    };

    list.appendChild(notDoneBtn);

    // ------------------------------------------------------
    // SPEICHERN
    // ------------------------------------------------------

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Alle neuen Intervalle speichern";
    saveBtn.classList.add("modern-btn");
    saveBtn.style.width = "100%";

    saveBtn.onclick = async () => {

      function parseTimeToSeconds(str) {
        if (!str) return null;
        const parts = str.split(":");
        if (parts.length === 2) {
          return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        return null;
      }

      const blocks = intervalContainer.querySelectorAll(".interval-block");
      let index = (existingTimes?.length || 0) + 1;

      for (const block of blocks) {
        const distance = block.querySelector(".distanceInput")?.value || null;
        const time = block.querySelector(".timeInput")?.value || null;
        const duration = block.querySelector(".durationInput")?.value || null;
        const pace = block.querySelector(".paceInput")?.value || null;
        const watt = block.querySelector(".wattInput")?.value || null;
        const heartrate = block.querySelector(".heartrateInput")?.value || null;

        let durationSeconds = null;
        if (time) durationSeconds = parseTimeToSeconds(time);
        else if (duration) durationSeconds = parseInt(duration);

        let paceSeconds = null;
        if (pace) paceSeconds = parseTimeToSeconds(pace);

        await supa.from("training_times").insert({
          date: dateString,
          athlete: athlete,
          sport: sport,
          interval_index: index,
          duration_seconds: durationSeconds,
          distance_meters: distance ? parseInt(distance) : null,
          pace_seconds_per_km: paceSeconds,
          watt: watt ? parseInt(watt) : null,
          heartrate: heartrate ? parseInt(heartrate) : null
        });

        index++;
      }

      alert("Alle Intervalle gespeichert!");
      overlay.remove();
    };

    list.appendChild(saveBtn);
  }

  // Popup anzeigen
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
// ------------------------------------------------------
// COACH-ANALYSE ÖFFNEN
// ------------------------------------------------------

async function openCoachAnalysis(athleteName) {
  const panel = document.getElementById("coachAnalysis");
  const title = document.getElementById("coachAnalysisTitle");
  const content = document.getElementById("coachAnalysisContent");

  panel.classList.remove("hidden");
  title.textContent = `Analyse für ${athleteName}`;
  content.innerHTML = "";

  // Daten laden
  const { data: times } = await supa
    .from("training_times")
    .select("*")
    .eq("athlete", athleteName)
    .order("date", { ascending: true });

  const { data: status } = await supa
    .from("training_status")
    .select("*")
    .eq("athlete", athleteName);

  const totalTrainings = times.length;
  const missedTrainings = status.filter(s => s.status === "not_done").length;

  // Kopfzeile
  content.innerHTML += `
    <div class="analysis-section">
      <h2>Überblick</h2>
      <div class="analysis-grid">
        <div class="analysis-box"><strong>Trainings:</strong><br>${totalTrainings}</div>
        <div class="analysis-box"><strong>Nicht gemacht:</strong><br>${missedTrainings}</div>
        <div class="analysis-box"><strong>Letztes Training:</strong><br>${times.at(-1)?.date || "-"}</div>
      </div>
    </div>
  `;

  // Sportarten trennen
  const swim = times.filter(t => t.sport === "schwimmen");
  const run = times.filter(t => t.sport === "lauf");
  const bike = times.filter(t => t.sport === "rad");

  // ------------------------------------------------------
  // SCHWIMMEN ANALYSE
  // ------------------------------------------------------

  if (swim.length > 0) {
    const avg100 = Math.round(
      swim.reduce((a, b) => a + (b.duration_seconds / (b.distance_meters / 100)), 0) / swim.length
    );

    const best100 = Math.min(
      ...swim.map(t => t.duration_seconds / (t.distance_meters / 100))
    );

    content.innerHTML += `
      <div class="analysis-section">
        <h2>Schwimmen</h2>
        <div class="analysis-grid">
          <div class="analysis-box"><strong>Ø Zeit / 100m:</strong><br>${formatSeconds(avg100)}</div>
          <div class="analysis-box"><strong>Beste Zeit / 100m:</strong><br>${formatSeconds(best100)}</div>
          <div class="analysis-box"><strong>Einheiten:</strong><br>${swim.length}</div>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------
  // LAUFEN ANALYSE
  // ------------------------------------------------------

  if (run.length > 0) {
    const avgPace = Math.round(
      run.reduce((a, b) => a + b.pace_seconds_per_km, 0) / run.length
    );

    const bestPace = Math.min(...run.map(t => t.pace_seconds_per_km));

    content.innerHTML += `
      <div class="analysis-section">
        <h2>Laufen</h2>
        <div class="analysis-grid">
          <div class="analysis-box"><strong>Ø Pace:</strong><br>${formatSeconds(avgPace)} / km</div>
          <div class="analysis-box"><strong>Beste Pace:</strong><br>${formatSeconds(bestPace)} / km</div>
          <div class="analysis-box"><strong>Einheiten:</strong><br>${run.length}</div>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------
  // RAD ANALYSE
  // ------------------------------------------------------

  if (bike.length > 0) {
    const avgDuration = Math.round(
      bike.reduce((a, b) => a + b.duration_seconds, 0) / bike.length
    );

    content.innerHTML += `
      <div class="analysis-section">
        <h2>Rad</h2>
        <div class="analysis-grid">
          <div class="analysis-box"><strong>Ø Dauer:</strong><br>${formatSeconds(avgDuration)}</div>
          <div class="analysis-box"><strong>Einheiten:</strong><br>${bike.length}</div>
          <div class="analysis-box"><strong>Letzte Einheit:</strong><br>${bike.at(-1).date}</div>
        </div>
      </div>
    `;
  }

  // Trainingsliste laden
  loadCoachTrainingList(athleteName);

  // Diagramme laden
  loadCoachCharts(times);
}

// ------------------------------------------------------
// TRAININGS-LISTE (Coach)
// ------------------------------------------------------

async function loadCoachTrainingList(athleteName) {
  const list = document.getElementById("coachTrainingList");
  list.innerHTML = "";

  const { data: times } = await supa
    .from("training_times")
    .select("*")
    .eq("athlete", athleteName)
    .order("date", { ascending: false });

  if (!times || times.length === 0) {
    list.innerHTML = "<p>Keine Trainings vorhanden.</p>";
    return;
  }

  const grouped = {};

  times.forEach(t => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });

  Object.keys(grouped).forEach(date => {
    const btn = document.createElement("button");
    btn.classList.add("training-entry");

    const sport = grouped[date][0].sport;

    const badge =
      sport === "schwimmen" ? "badge-swim" :
      sport === "lauf" ? "badge-run" :
      "badge-bike";

    btn.innerHTML = `
      <span class="badge ${badge}">${sport}</span>
      <span style="margin-left:10px;">${date}</span>
    `;

    btn.onclick = () => openCoachTrainingDetail(athleteName, date);
    list.appendChild(btn);
  });
}

// ------------------------------------------------------
// TRAINING-DETAILS (Coach)
// ------------------------------------------------------

async function openCoachTrainingDetail(athleteName, date) {
  const detail = document.getElementById("coachTrainingDetail");
  detail.innerHTML = `<h2>Training am ${date}</h2>`;

  const { data: times } = await supa
    .from("training_times")
    .select("*")
    .eq("athlete", athleteName)
    .eq("date", date)
    .order("interval_index", { ascending: true });

  if (!times || times.length === 0) {
    detail.innerHTML += "<p>Keine Intervalle vorhanden.</p>";
    return;
  }

  let html = `
    <table class="coach-table">
      <tr>
        <th>Intervall</th>
        <th>Dauer</th>
        <th>Distanz</th>
        <th>Pace</th>
        <th>Watt</th>
        <th>Puls</th>
      </tr>
  `;

  times.forEach(t => {
    html += `
      <tr>
        <td>${t.interval_index}</td>
        <td>${formatSeconds(t.duration_seconds)}</td>
        <td>${t.distance_meters ?? "-"}</td>
        <td>${t.pace_seconds_per_km ? formatSeconds(t.pace_seconds_per_km) + "/km" : "-"}</td>
        <td>${t.watt ?? "-"}</td>
        <td>${t.heartrate ?? "-"}</td>
      </tr>
    `;
  });

  html += "</table>";
  detail.innerHTML += html;
}



// ------------------------------------------------------
// CLOSE BUTTON
// ------------------------------------------------------

document.getElementById("coachAnalysisClose").onclick = () => {
  document.getElementById("coachAnalysis").classList.add("hidden");
};
// ------------------------------------------------------
// MONATSWECHSEL
// ------------------------------------------------------

document.getElementById("prevMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});


// ------------------------------------------------------
// EXCEL IMPORT (Coach) – FUNKTIONIERT
// ------------------------------------------------------

document.getElementById("excelImportBtn").onclick = () => {
  document.getElementById("excelFileInput").click();
};

document.getElementById("excelFileInput").addEventListener("change", handleExcelImport);

async function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    const newTrainings = [];

    // ALLE Tabellenblätter durchgehen
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      rows.forEach(row => {
        const date = formatExcelDate(row["Datum"]);
        if (!date) return;

        // Phase (Trainingsphase)
        if (row["Trainingsphase"]) {
          newTrainings.push({
  date: date,
  athlete: "Phase",
  phase: row["Trainingsphase"],
  training: row["konkretes Training"] || ""
});

        }

      ["Lasse", "Tora", "Kerstin"].forEach(name => {
  if (row[name] && row[name].trim() !== "") {
    newTrainings.push({
      date: date,
      athlete: name,
      phase: row["Trainingsphase"] || "",
      training: row["konkretes Training"] || ""
    });
  }
});
});
    });

    // In Supabase speichern
    const { error } = await supa.from("trainings").insert(newTrainings);

    if (error) {
      console.error(error);
      alert("Fehler beim Import.");
      return;
    }

    alert("Excel erfolgreich importiert!");
    await loadTrainings();
    renderCalendar();
  };

  reader.readAsArrayBuffer(file);
}


// ------------------------------------------------------
// WORD IMPORT (Coach) – FUNKTIONIERT
// ------------------------------------------------------

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

      const phase = name.split("(")[0].trim();
      const variantMatch = name.match(/ChatGPT\s*\d+/i);
      const variant = variantMatch ? variantMatch[0] : "";
      const sport = name.split(")").pop().trim();

      const filePath = `${Date.now()}-${file.name}`;

      await supa.storage
        .from("training-docs")
        .upload(filePath, file, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          cacheControl: "3600",
          upsert: false
        });

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
// ------------------------------------------------------
// INIT
// ------------------------------------------------------
async function init() {

  // USER LADEN
  const { data: userData } = await supa.auth.getUser();
  const user = userData?.user;

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;

  // PROFIL LADEN
  const { data: profile } = await supa
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile) {
    currentAthleteName = profile.athlete_name;   // <-- RICHTIG
  }

  // COACH ERKENNEN
  isCoach = user.email === "coach@training.de";

  console.log("Eingeloggt als:", user.email);
  console.log("isCoach:", isCoach);
  console.log("currentAthleteName:", currentAthleteName);

  // COACH-ONLY ELEMENTE
  document.querySelectorAll(".coach-only").forEach(el => {
    el.style.display = isCoach ? "inline-block" : "none";
  });

  const athleteButtons = document.getElementById("coachAthleteButtons");
  if (!isCoach && athleteButtons) {
    athleteButtons.style.display = "none";
  }

  // DATEN LADEN
  await loadTrainings();
  await loadWordFiles();

  // KALENDER RENDERN
  renderCalendar();
  let trainings = allTrainings;

// Coach sieht ALLES
if (!isCoach) {
    // Athlet sieht NUR seine eigenen Trainings
    trainings = trainings.filter(t => t.athlete === currentAthleteName);
}

}
