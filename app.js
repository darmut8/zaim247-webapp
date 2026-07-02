(() => {
  const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();

  const $ = (id) => document.getElementById(id);
  const fullName = $("fullName");
  const age = $("age");
  const phone = $("phone");
  const tgPhoneBtn = $("tgPhoneBtn");
  const amountSlider = $("amountSlider");
  const amountValue = $("amountValue");
  const amountReturn = $("amountReturn");
  const purpose = $("purpose");
  const consent = $("consent");
  const cityOther = $("cityOther");
  const loanForm = $("loanForm");
  const wheelScreen = $("wheelScreen");
  const wheelWrap = $("wheelWrap");
  const wheelEl = $("wheel");
  const spinBtn = $("spinBtn");
  const prizeResult = $("prizeResult");
  const finalSubmitBtn = $("finalSubmitBtn");
  const skipWheelBtn = $("skipWheelBtn");

  let selectedCity = "";
  let phoneSharedViaTelegram = false;
  let stage = "form"; // "form" -> "wheel" -> "confirm"
  let wonPrize = null;
  let spun = false;

  // Prize order matches the 6 wheel__label elements / conic-gradient sectors
  // in index.html (60° each). Odds are independent of the equal visual size —
  // a common, honest "prize wheel" trick: pick the prize first, then land on it.
  const PRIZES = [
    { label: "Месяц без %", weight: 5 },
    { label: "−50% на комиссию", weight: 15 },
    { label: "Приоритет заявки", weight: 25 },
    { label: "Скидка от менеджера", weight: 20 },
    { label: "+5 дней бесплатно", weight: 20 },
    { label: "Удача в другой раз", weight: 15 },
  ];
  const SECTOR_DEG = 360 / PRIZES.length;

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
    purpose.classList.toggle("invalid", !!errors.purpose);

    return { ok: Object.keys(errors).length === 0, errors };
  };

  // ─── Build payload from current field values ──
  const buildPayload = (ok, errors) => {
    const phoneDigits = phone.value.replace(/\D/g, "");
    const name = fullName.value.trim();
    return {
      full_name: name,
      age: parseInt(age.value, 10) || "",
      city: selectedCity,
      phone: phoneSharedViaTelegram ? "" : (phoneDigits ? "+" + phoneDigits : ""),
      phone_from_telegram: phoneSharedViaTelegram,
      amount: +amountSlider.value,
      purpose: purpose.value.trim(),
      partial: !ok,
      invalid_fields: Object.keys(errors),
      prize: wonPrize,
    };
  };

  const sendAndClose = (payload) => {
    if (tg) {
      tg.sendData(JSON.stringify(payload));
      setTimeout(() => tg.close(), 300);
    } else {
      console.log("Submit payload:", payload);
      alert(payload.partial
        ? "Данные отправлены менеджеру (откройте в Telegram)"
        : "Заявка отправлена! (откройте в Telegram)");
    }
  };

  // ─── Wheel screen ──────────────────────────
  const pickPrizeIndex = () => {
    const total = PRIZES.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < PRIZES.length; i++) {
      if (r < PRIZES[i].weight) return i;
      r -= PRIZES[i].weight;
    }
    return PRIZES.length - 1;
  };

  const showWheelScreen = () => {
    stage = "wheel";
    loanForm.hidden = true;
    wheelScreen.hidden = false;
    tg?.MainButton.hide();
    wheelScreen.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const spinWheel = () => {
    if (spun) return;
    spun = true;
    spinBtn.disabled = true;
    wheelWrap.classList.add("is-spinning");
    haptic("selection");

    const idx = pickPrizeIndex();
    wonPrize = PRIZES[idx].label;
    const sectorCenter = idx * SECTOR_DEG + SECTOR_DEG / 2;
    const fullSpins = 6;
    const jitter = Math.random() * (SECTOR_DEG * 0.6) - SECTOR_DEG * 0.3;
    const targetDeg = fullSpins * 360 + (360 - sectorCenter) + jitter;
    wheelEl.style.transform = `rotate(${targetDeg}deg)`;
  };

  const revealPrize = () => {
    stage = "confirm";
    prizeResult.hidden = false;
    prizeResult.textContent = `🎉 Ваш бонус: ${wonPrize}`;
    skipWheelBtn.hidden = true;
    haptic("success");
    if (tg) {
      tg.MainButton.setText("Отправить заявку");
      tg.MainButton.show();
    } else {
      finalSubmitBtn.hidden = false;
    }
  };

  const finalSubmit = () => {
    haptic("success");
    sendAndClose(buildPayload(true, {}));
  };

  wheelEl.addEventListener("transitionend", () => {
    if (spun && stage === "wheel") revealPrize();
  });
  spinBtn.addEventListener("click", spinWheel);
  finalSubmitBtn.addEventListener("click", finalSubmit);
  skipWheelBtn.addEventListener("click", finalSubmit);

  // ─── Main entry point (form step) ─────────
  const handlePrimaryAction = () => {
    if (stage === "confirm") {
      finalSubmit();
      return;
    }
    if (stage === "wheel") return; // waiting on the spin

    const { ok, errors } = validate();
    const payload = buildPayload(ok, errors);

    if (!ok) {
      haptic("error");
      const firstInvalid = document.querySelector(".invalid");
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });

      // Guard: don't send a completely empty form (accidental taps).
      const hasData =
        payload.full_name.length >= 2 || phoneSharedViaTelegram ||
        phone.value.replace(/\D/g, "").length >= 7;
      if (!hasData) {
        tg?.showAlert(Object.values(errors)[0] || "Заполните форму");
        return;
      }
      // Partial lead → skip the wheel, send straight away.
      sendAndClose(payload);
      return;
    }

    haptic("success");
    showWheelScreen();
  };

  tg?.MainButton.onClick(handlePrimaryAction);

  loanForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handlePrimaryAction();
  });
})();
