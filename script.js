// ------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------

let currentUser = null;
let trainings = [];
let wordFiles = [];
let currentDate = new Date();

// Zeitformatierung
function formatSeconds(sec) {
  if (sec === null || sec === undefined) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ------------------------------------------------------
// INIT
// ------------------------------------------------------

async function init() {
  // User laden
  const { data: userData } = await supa.auth.getUser();
  const user = userData?.user;

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const isCoach = user.email === "coach@training.de";

  // --- COACH-ONLY ELEMENTE ---
  const coachOnly = document.querySelectorAll(".coach-only");

  if (isCoach) {
    coachOnly.forEach(el => el.style.display = "inline-block");
  } else {
    coachOnly.forEach(el => el.style.display = "none");
  }

  // --- COACH-ATHLETEN-BUTTONS ---
  const athleteButtons = document.getElementById("coachAthleteButtons");
  if (!isCoach && athleteButtons) {
    athleteButtons.style.display = "none";
  }

  // --- DATEN LADEN ---
  await loadTrainings();   // wichtig: MUSS vor renderCalendar laufen
  await loadWordFiles();

  // --- KALENDER RENDERN ---
  renderCalendar();
}

window.addEventListener("load", init);


// ------------------------------------------------------
// TRAININGS LADEN
// ------------------------------------------------------

async function loadTrainings() {
  const { data, error } = await supa
    .from("trainings")
    .select("*")
    .order("date", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden der Trainings:", error);
    trainings = [];
    return;
  }

  if (currentUser.email === "coach@training.de") {
    trainings = data || [];
    return;
  }

  const athlete = getAthleteNameFromEmail(currentUser.email);
  trainings = (data || []).filter(t => t.athlete === athlete);
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
    const dayTrainings = trainings.filter(t => t.date === dateString);

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

    cell.addEventListener("click", () => openDayPopup(dateString));
    calendarGrid.appendChild(cell);
  }
}
// ------------------------------------------------------
// POPUP – TRAININGSTAG (ATHLET + PLAN + PRO-ANALYSE)
// ------------------------------------------------------

async function openDayPopup(dateString) {
  // Altes Popup entfernen
  const oldPopup = document.querySelector(".apple-popup-overlay");
  if (oldPopup) oldPopup.remove();

  // Overlay + Box
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

  // Trainings für den Tag
  const items = trainings.filter(t => t.date === dateString);

  // ------------------------------------------------------
  // TRAININGSPLAN ANZEIGEN
  // ------------------------------------------------------

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

      // Word-Datei Download
      let downloadAdded = false;

wordFiles.forEach(w => {
  if (downloadAdded) return;

  if ((t.athlete || "").toLowerCase() === "phase") return;

  const normalize = str =>
    (str || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");

  const trainingPhase   = normalize(t.phase);
  const trainingSport   = normalize(t.sport);
  const trainingVariant = normalize(t.variant);

  const wordPhase   = normalize(w.phase);
  const wordSport   = normalize(w.sport);
  const wordVariant = normalize(w.variant);

  const phaseMatch   = trainingPhase.includes(wordPhase) || wordPhase.includes(trainingPhase);
  const sportMatch   = trainingSport.includes(wordSport) || wordSport.includes(trainingSport);
  const variantMatch = trainingVariant.includes(wordVariant) || wordVariant.includes(trainingVariant);

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



 })
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
        // LÖSCHEN-BUTTON (FIXED VERSION)
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

        // WICHTIG: t.id in eine eigene Variable speichern
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

      // Mini-KI Kommentar
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

  // Schwimmen Analyse
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

  // Laufen Analyse
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

  // Rad Analyse
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
  loadCoachCharts(times);


// ------------------------------------------------------
// TRAININGS-LISTE
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
}

// ------------------------------------------------------
// TRAINING-DETAILS
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
// DIAGRAMME
// ------------------------------------------------------

function loadCoachCharts(times) {
  const ctx = document.getElementById("coachChart");

  if (!ctx) {
    console.error("Canvas #coachChart nicht gefunden!");
    return;
  }

  if (!times || times.length === 0) return;

  const labels = times.map(t => t.date);
  const durations = times.map(t => t.duration_seconds);

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Dauer (Sekunden)",
        data: durations,
        borderColor: "#007aff",
        backgroundColor: "rgba(0,122,255,0.15)",
        borderWidth: 3,
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: "#007aff",
        pointBorderColor: "#fff",
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { font: { size: 16 } }
        }
      },
      scales: {
        y: { ticks: { font: { size: 14 } } },
        x: { ticks: { font: { size: 14 } } }
      }
    }
  });
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
// EXCEL IMPORT (Coach) – ALLE MONATE, ROBUST
// ------------------------------------------------------

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

    // Alte Einträge löschen
    await supa.from("trainings").delete().neq("id", 0);

    const inserts = [];
    const sports = ["schwimmen", "rad", "lauf", "koppel", "freiwasser"];

    // 🔥 ALLE Tabellenblätter durchgehen
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      // Leere Sheets überspringen
      if (rows.length === 0) continue;

      console.log("Importiere Blatt:", sheetName);

      rows.forEach(row => {

        // Spaltennamen normalisieren
        const normalized = {};
        Object.keys(row).forEach(key => {
          normalized[key.trim().toLowerCase()] = row[key];
        });

        // Datum erkennen
        let excelDate =
          normalized["datum"] ||
          normalized["date"] ||
          normalized["tag"] ||
          normalized["__empty"] ||
          normalized["__empty_1"];

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

        // Trainingsphase
        const rawPhase = (normalized["trainingsphase"] || "").trim().toLowerCase();
        const phase = rawPhase.split("(")[0].trim();

        // Konkretes Training
        const rawDetail = (normalized["konkretes training"] || normalized["training"] || "").trim().toLowerCase();

        let sport = "";
        let variant = "";

        const bracketMatch = rawDetail.match(/\((.*?)\)/);
        let inside = bracketMatch ? bracketMatch[1].trim() : "";

        if (sports.some(s => inside.includes(s))) {
          sport = sports.find(s => inside.includes(s));
        } else if (inside.includes("chatgpt")) {
          variant = inside;
        }

        const before = rawDetail.split("(")[0].trim();

        if (!variant) {
          const vMatch = before.match(/chatgpt\s*\d+/i);
          if (vMatch) variant = vMatch[0].toLowerCase();
        }

        if (!sport) {
          const sMatch = sports.find(s => before.includes(s));
          if (sMatch) sport = sMatch;
        }

        // Athleten
        ["lasse","tora","kerstin"].forEach(name => {
          const value = normalized[name];
          if (value && value.trim() !== "") {
            inserts.push({
              date: dateString,
              athlete: name.charAt(0).toUpperCase() + name.slice(1),
              training: value,
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
    }

    // Alles speichern
    if (inserts.length > 0) {
      await supa.from("trainings").insert(inserts);
    }

    await loadTrainings();
await loadWordFiles();

// HIER GENAU
console.log("Training Beispiel:", trainings[0]);
console.log("Word Beispiel:", wordFiles[0]);

renderCalendar();


  };

  input.click();
});


// ------------------------------------------------------
// WORD IMPORT (Coach)
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
