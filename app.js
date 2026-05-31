(() => {
  const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();

  const $ = (id) => document.getElementById(id);
  const fullName = $("fullName");
  const age = $("age");
  const phone = $("phone");
  const tgPhoneBtn = $("tgPhoneBtn");
  const inn = $("inn");
  const card = $("card");
  const amountSlider = $("amountSlider");
  const amountValue = $("amountValue");
  const amountReturn = $("amountReturn");
  const purpose = $("purpose");
  const consent = $("consent");
  const cityOther = $("cityOther");

  let selectedCity = "";
  let phoneSharedViaTelegram = false;

  const fmt = (n) => n.toLocaleString("ru-RU").replace(/,/g, " ");
  const haptic = (type = "selection") => {
    if (!tg?.HapticFeedback) return;
    if (type === "selection") tg.HapticFeedback.selectionChanged();
    else tg.HapticFeedback.notificationOccurred(type);
  };

  // ─── MainButton ───────────────────────────
  if (tg) {
    tg.MainButton.setText("Получить деньги");
    tg.MainButton.color = "#235BDD";
    tg.MainButton.textColor = "#FFFFFF";
    tg.MainButton.show();
    tg.MainButton.enable();
  }

  // ─── Age digits only, 0-99 ────────────────
  age.addEventListener("input", () => {
    age.value = age.value.replace(/\D/g, "").slice(0, 2);
  });

  // ─── Phone mask ───────────────────────────
  phone.addEventListener("input", () => {
    let v = phone.value.replace(/\D/g, "");
    if (v.startsWith("8")) v = "7" + v.slice(1);
    if (v && !v.startsWith("7")) v = "7" + v;
    v = v.slice(0, 11);
    let f = "+7";
    if (v.length > 1) f += " (" + v.slice(1, 4);
    if (v.length >= 5) f += ") " + v.slice(4, 7);
    if (v.length >= 8) f += "-" + v.slice(7, 9);
    if (v.length >= 10) f += "-" + v.slice(9, 11);
    phone.value = f;
  });
  phone.addEventListener("focus", () => {
    if (!phone.value) phone.value = "+7";
  });

  // ─── Share phone from Telegram ────────────
  tgPhoneBtn.addEventListener("click", () => {
    if (!tg || typeof tg.requestContact !== "function") {
      tg?.showAlert("Эта функция требует Telegram версии 6.9 или новее. Введите номер вручную.");
      return;
    }
    haptic("selection");
    tg.requestContact((ok) => {
      if (!ok) {
        haptic("error");
        return;
      }
      phoneSharedViaTelegram = true;
      tgPhoneBtn.classList.add("tg-phone-btn--success");
      tgPhoneBtn.innerHTML = '<span class="tg-phone-btn__icon">✓</span><span>Номер из Telegram передан</span>';
      // Clear validation error if any
      phone.classList.remove("invalid");
      const phoneErr = document.querySelector('.error[data-for="phone"]');
      if (phoneErr) phoneErr.textContent = "";
      // Set a placeholder marker — bot will look up the real phone from contact share
      if (!phone.value || phone.value === "+7") {
        phone.value = "из Telegram";
        phone.readOnly = true;
      }
      haptic("success");
    });
  });

  // ─── ИНН digits only ──────────────────────
  inn.addEventListener("input", () => {
    inn.value = inn.value.replace(/\D/g, "").slice(0, 12);
  });

  // ─── Card mask: 1234 5678 9012 3456 ───────
  card.addEventListener("input", () => {
    let v = card.value.replace(/\D/g, "").slice(0, 19);
    card.value = v.replace(/(\d{4})(?=\d)/g, "$1 ");
  });

  // ─── Scan card with camera + OCR ──────────
  const scanBtn = $("scanBtn");
  const scanInput = $("scanInput");
  const ORIGINAL_SCAN_TEXT = "📷 Сканировать карту";
  let tesseractLoaded = false;
  let scanning = false;

  const setScanBtn = (text, disabled = false) => {
    scanBtn.textContent = text;
    scanBtn.classList.toggle("scan-btn--disabled", disabled);
  };

  const loadTesseract = () => new Promise((resolve, reject) => {
    if (tesseractLoaded && window.Tesseract) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = () => { tesseractLoaded = true; resolve(); };
    s.onerror = () => reject(new Error("Не удалось загрузить модуль OCR"));
    document.head.appendChild(s);
  });

  // Haptic on tap of label
  scanBtn.addEventListener("click", () => {
    if (scanning) return;
    haptic("selection");
  });

  scanInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file || scanning) return;

    scanning = true;
    setScanBtn("⏳ Загрузка модуля…", true);

    try {
      await loadTesseract();
      setScanBtn("🔍 Распознавание…", true);

      const worker = await Tesseract.createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setScanBtn(`🔍 ${Math.round(m.progress * 100)}%`, true);
          }
        },
      });
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789 ",
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const text = (data.text || "").replace(/[^\d\s]/g, " ");
      const match = text.match(/(\d{4}[\s]*\d{4}[\s]*\d{4}[\s]*\d{4}(?:[\s]*\d{0,3})?)/);
      if (match) {
        const digits = match[1].replace(/\D/g, "").slice(0, 19);
        if (digits.length >= 16) {
          card.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
          card.classList.remove("invalid");
          document.querySelector('.error[data-for="card"]').textContent = "";
          haptic("success");
        } else {
          throw new Error("Слишком мало цифр");
        }
      } else {
        throw new Error("Номер не найден");
      }
    } catch (err) {
      console.error("Scan error:", err);
      haptic("error");
      tg?.showAlert(
        "Не удалось распознать карту: " + (err?.message || "ошибка") +
        ".\nПопробуйте при хорошем освещении или введите вручную."
      );
    } finally {
      scanning = false;
      setScanBtn(ORIGINAL_SCAN_TEXT, false);
      scanInput.value = "";
    }
  });

  // ─── City chips ───────────────────────────
  document.querySelectorAll(".chip-city").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip-city").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      haptic("selection");
      if (chip.dataset.city === "__other__") {
        cityOther.style.display = "block";
        cityOther.focus();
        selectedCity = cityOther.value.trim();
      } else {
        cityOther.style.display = "none";
        cityOther.value = "";
        selectedCity = chip.dataset.city;
      }
    });
  });
  cityOther.addEventListener("input", () => {
    selectedCity = cityOther.value.trim();
  });

  // ─── Slider + amount display ──────────────
  const updateSlider = () => {
    const min = +amountSlider.min;
    const max = +amountSlider.max;
    const v = +amountSlider.value;
    const p = ((v - min) / (max - min)) * 100;
    amountSlider.style.setProperty("--progress", p + "%");
    amountValue.textContent = fmt(v);
    amountReturn.textContent = fmt(v) + " ₽";
    document.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("active", +c.dataset.amount === v);
    });
  };
  amountSlider.addEventListener("input", updateSlider);
  amountSlider.addEventListener("change", () => haptic("selection"));
  updateSlider();

  // ─── Step buttons ─────────────────────────
  document.querySelectorAll(".step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = +btn.dataset.step;
      const min = +amountSlider.min;
      const max = +amountSlider.max;
      let v = +amountSlider.value + step;
      v = Math.min(max, Math.max(min, v));
      amountSlider.value = v;
      updateSlider();
      haptic("selection");
    });
  });

  // ─── Amount chips ─────────────────────────
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      amountSlider.value = chip.dataset.amount;
      updateSlider();
      haptic("selection");
    });
  });

  // ─── Purpose chips ────────────────────────
  document.querySelectorAll(".chip-purpose").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip-purpose").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      purpose.value = chip.dataset.purpose;
      haptic("selection");
    });
  });
  purpose.addEventListener("input", () => {
    document.querySelectorAll(".chip-purpose").forEach((c) => c.classList.remove("active"));
  });

  // ─── Validation ───────────────────────────
  const validate = () => {
    const errors = {};

    const name = fullName.value.trim();
    if (name.split(/\s+/).length < 2 || /\d/.test(name) || name.length > 100) {
      errors.fullName = "Введите имя и фамилию через пробел";
    }

    const ageVal = parseInt(age.value, 10);
    if (isNaN(ageVal) || ageVal < 18 || ageVal > 70) {
      errors.age = "Возраст от 18 до 70 лет";
    }

    if (!selectedCity || selectedCity.length < 2 || selectedCity.length > 60) {
      errors.city = "Выберите город из списка или укажите свой";
    }

    if (!phoneSharedViaTelegram) {
      const digits = phone.value.replace(/\D/g, "");
      if (digits.length !== 11 || !digits.startsWith("7")) {
        errors.phone = "Введите номер полностью";
      }
    }

    if (!/^\d{12}$/.test(inn.value)) {
      errors.inn = "ИНН должен содержать 12 цифр";
    }

    const cardDigits = card.value.replace(/\D/g, "");
    if (cardDigits.length < 16 || cardDigits.length > 19) {
      errors.card = "Введите номер карты (16 цифр)";
    }

    const amount = +amountSlider.value;
    if (amount < 1000 || amount > 100000) {
      errors.amount = "Сумма от 1 000 до 100 000 ₽";
    }

    const p = purpose.value.trim();
    if (p.length < 3 || p.length > 200) {
      errors.purpose = "Опишите цель (от 3 символов)";
    }

    if (!consent.checked) errors.consent = "Необходимо согласие";

    document.querySelectorAll(".error").forEach((el) => {
      el.textContent = errors[el.dataset.for] || "";
    });
    fullName.classList.toggle("invalid", !!errors.fullName);
    age.classList.toggle("invalid", !!errors.age);
    phone.classList.toggle("invalid", !!errors.phone);
    inn.classList.toggle("invalid", !!errors.inn);
    card.classList.toggle("invalid", !!errors.card);
    purpose.classList.toggle("invalid", !!errors.purpose);

    return { ok: Object.keys(errors).length === 0, errors };
  };

  // ─── Submit ───────────────────────────────
  const submit = () => {
    const { ok, errors } = validate();
    if (!ok) {
      haptic("error");
      const firstError = Object.values(errors)[0];
      tg?.showAlert(firstError || "Проверьте правильность заполнения формы");
      const firstInvalid = document.querySelector(".invalid");
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const payload = {
      full_name: fullName.value.trim(),
      age: parseInt(age.value, 10),
      city: selectedCity,
      phone: phoneSharedViaTelegram ? "" : "+" + phone.value.replace(/\D/g, ""),
      phone_from_telegram: phoneSharedViaTelegram,
      inn: inn.value,
      card: card.value.replace(/\D/g, ""),
      amount: +amountSlider.value,
      purpose: purpose.value.trim(),
    };

    haptic("success");
    if (tg) {
      tg.sendData(JSON.stringify(payload));
      setTimeout(() => tg.close(), 300);
    } else {
      console.log("Submit payload:", payload);
      alert("Заявка отправлена! (откройте в Telegram)");
    }
  };

  tg?.MainButton.onClick(submit);

  document.getElementById("loanForm").addEventListener("submit", (e) => {
    e.preventDefault();
    submit();
  });
})();
