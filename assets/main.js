/* Madeofnext: cinematic portfolio
   No build step. GSAP + ScrollTrigger + Lenis are loaded from a CDN;
   if any fail to load, the page still works as a normal scrolling site. */

(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const SPECTRUM = ["#7CF5FF", "#B79CFF", "#FFC6A8"];

  /* ------------------------------------------------------------------
     Project data: replace with real case studies
     ------------------------------------------------------------------ */
  const PROJECTS = [
    {
      name: "Halden",
      year: "2026",
      line: "Brand and member app for a Nordic energy co-op that lets neighbours trade solar power.",
      discipline: "Brand identity, Digital product",
      scene: "orbit",
      palette: ["#0E2A3A", "#7CF5FF", "#F2EEE6", "#2E6F8E"],
      summary: "Halden needed to feel as dependable as a utility and as personal as a group chat. We built a brand around the sun's daily arc and an app that shows every household what its roof earned today.",
      facts: [["Role", "Naming, identity, app design"], ["Platforms", "iOS, Android, web"], ["Outcome", "38,000 members in the first year"]],
    },
    {
      name: "Ferro",
      year: "2026",
      line: "Launch film and motion system for a warehouse robotics startup coming out of stealth.",
      discipline: "Motion & film",
      scene: "monolith",
      palette: ["#1A0F0A", "#FF8A4C", "#FFC6A8", "#5B2A18"],
      summary: "A ninety-second film that never shows the robot until the last frame. The motion system we built for it now runs through Ferro's product UI, trade-show screens and investor deck.",
      facts: [["Role", "Direction, 3D, motion system"], ["Format", "90s hero film, 12 cut-downs"], ["Outcome", "1.2M views in launch week"]],
    },
    {
      name: "Sola Health",
      year: "2025",
      line: "A calmer patient app for a chain of fertility clinics, designed with nurses and patients.",
      discipline: "Digital product, Research",
      scene: "bloom",
      palette: ["#2A1638", "#FFB8D9", "#B79CFF", "#F2EEE6"],
      summary: "Thirty interviews later, the brief changed from 'add features' to 'remove fear'. The app now shows one next step at a time, with a nurse's name and face attached to it.",
      facts: [["Role", "Research, UX, UI, design system"], ["Platforms", "iOS, Android"], ["Outcome", "Support calls down 41%"]],
    },
    {
      name: "Northbound",
      year: "2025",
      line: "Identity and generative cover system for an independent electronic music label.",
      discipline: "Brand identity, Motion & film",
      scene: "type",
      palette: ["#0B1F14", "#C8FF9E", "#7CF5FF", "#1F4A33"],
      summary: "Every release gets a unique cover generated from its own audio waveform, so the label's catalogue reads as one family without two sleeves ever looking alike.",
      facts: [["Role", "Identity, generative tooling"], ["Format", "Covers, visualisers, merch"], ["Outcome", "140 releases and counting"]],
    },
    {
      name: "Atlas Freight",
      year: "2024",
      line: "Operations dashboard that turned 14 legacy tools into one live map of a shipping network.",
      discipline: "Digital product",
      scene: "dunes",
      palette: ["#141A3A", "#B79CFF", "#7CF5FF", "#3A3F7A"],
      summary: "Dispatchers used to keep a spreadsheet open next to four other screens. We designed a single live map where every truck, delay and decision sits in one place.",
      facts: [["Role", "Product strategy, UX, front-end"], ["Users", "600 dispatchers, 9 countries"], ["Outcome", "Planning time cut by half"]],
    },
  ];

  /* ------------------------------------------------------------------
     Generative "film stills" for each project (no image assets needed)
     ------------------------------------------------------------------ */
  function seeded(seed) {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  }

  function drawStill(canvas, project, index) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 1200;
    const h = canvas.clientHeight || 500;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const c = canvas.getContext("2d");
    c.scale(dpr, dpr);
    const [bg, a, b, d] = project.palette;
    const rnd = seeded(97 + index * 131);

    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);

    const glow = (x, y, r, color, alpha = 1) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "transparent");
      c.globalAlpha = alpha;
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
      c.globalAlpha = 1;
    };

    switch (project.scene) {
      case "orbit": {
        const cx = w * 0.62, cy = h * 0.58;
        glow(cx, cy, h * 1.1, d, 0.9);
        c.strokeStyle = b;
        for (let i = 1; i <= 9; i++) {
          c.globalAlpha = 0.5 - i * 0.045;
          c.lineWidth = 1;
          c.beginPath();
          c.ellipse(cx, cy, i * h * 0.13, i * h * 0.045, -0.18, 0, Math.PI * 2);
          c.stroke();
        }
        c.globalAlpha = 1;
        glow(cx, cy, h * 0.42, a, 0.85);
        c.fillStyle = b;
        c.beginPath(); c.arc(cx, cy, h * 0.11, 0, Math.PI * 2); c.fill();
        // small satellites
        for (let i = 0; i < 5; i++) {
          const ang = rnd() * Math.PI * 2, r = (2 + i * 1.5) * h * 0.13;
          const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * 0.35;
          c.fillStyle = a;
          c.beginPath(); c.arc(x, y, 2 + rnd() * 3, 0, Math.PI * 2); c.fill();
        }
        break;
      }
      case "monolith": {
        glow(w * 0.5, h * 1.05, h * 1.2, a, 0.75);
        // light rays
        c.save();
        c.globalCompositeOperation = "lighter";
        for (let i = 0; i < 18; i++) {
          const x = w * 0.5 + (rnd() - 0.5) * w * 0.9;
          const grad = c.createLinearGradient(w * 0.5, h, x, 0);
          grad.addColorStop(0, b);
          grad.addColorStop(1, "transparent");
          c.globalAlpha = 0.05 + rnd() * 0.07;
          c.fillStyle = grad;
          c.beginPath();
          c.moveTo(w * 0.5 - 6, h); c.lineTo(x - 30, 0); c.lineTo(x + 30, 0); c.lineTo(w * 0.5 + 6, h);
          c.fill();
        }
        c.restore();
        c.globalAlpha = 1;
        // the slab
        const sw = h * 0.22, sh = h * 0.78;
        const lg = c.createLinearGradient(w * 0.5 - sw / 2, 0, w * 0.5 + sw / 2, 0);
        lg.addColorStop(0, "#050302"); lg.addColorStop(0.5, d); lg.addColorStop(1, "#050302");
        c.fillStyle = lg;
        c.fillRect(w * 0.5 - sw / 2, h - sh, sw, sh);
        c.fillStyle = b; c.globalAlpha = 0.8;
        c.fillRect(w * 0.5 - sw / 2, h - sh, sw, 1.5);
        c.globalAlpha = 1;
        break;
      }
      case "bloom": {
        c.filter = "blur(40px)";
        for (let i = 0; i < 7; i++) {
          c.fillStyle = [a, b, d][i % 3];
          c.globalAlpha = 0.55;
          c.beginPath();
          c.arc(w * (0.2 + rnd() * 0.6), h * (0.2 + rnd() * 0.6), h * (0.18 + rnd() * 0.25), 0, Math.PI * 2);
          c.fill();
        }
        c.filter = "none";
        c.globalAlpha = 0.9;
        c.strokeStyle = d; c.lineWidth = 1.5;
        c.beginPath(); c.arc(w * 0.5, h * 0.5, h * 0.36, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1;
        break;
      }
      case "type": {
        glow(w * 0.3, h * 0.3, h, d, 0.9);
        c.fillStyle = a;
        c.font = `800 ${h * 1.35}px "Bricolage Grotesque", sans-serif`;
        c.textBaseline = "alphabetic";
        c.fillText("N", w * 0.08, h * 1.08);
        // waveform bars
        c.fillStyle = b;
        const bars = 64, bw = (w * 0.45) / bars;
        for (let i = 0; i < bars; i++) {
          const amp = (Math.sin(i * 0.35) * 0.5 + 0.5) * (0.3 + rnd() * 0.7) * h * 0.42;
          c.globalAlpha = 0.85;
          c.fillRect(w * 0.5 + i * bw, h * 0.5 - amp / 2, Math.max(1, bw * 0.45), amp);
        }
        c.globalAlpha = 1;
        break;
      }
      case "dunes": {
        for (let layer = 0; layer < 9; layer++) {
          const y0 = h * (0.3 + layer * 0.08);
          const grad = c.createLinearGradient(0, y0 - h * 0.1, 0, h);
          grad.addColorStop(0, layer % 2 ? a : b);
          grad.addColorStop(1, bg);
          c.globalAlpha = 0.18 + layer * 0.07;
          c.fillStyle = grad;
          c.beginPath();
          c.moveTo(0, h);
          const f = 1.5 + rnd() * 2, ph = rnd() * 6;
          for (let x = 0; x <= w; x += 8) {
            c.lineTo(x, y0 + Math.sin(x / w * Math.PI * f + ph) * h * 0.06);
          }
          c.lineTo(w, h);
          c.fill();
        }
        c.globalAlpha = 1;
        // route dots
        c.fillStyle = "#F2EEE6";
        for (let i = 0; i < 26; i++) {
          c.globalAlpha = 0.4 + rnd() * 0.6;
          c.beginPath(); c.arc(rnd() * w, h * (0.25 + rnd() * 0.6), 1.5, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
        break;
      }
    }

    // anamorphic vignette
    const v = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
    v.addColorStop(0, "transparent");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  }

  /* ------------------------------------------------------------------
     Render the reel
     ------------------------------------------------------------------ */
  const track = document.querySelector(".reel__track");
  PROJECTS.forEach((p, i) => {
    const li = document.createElement("li");
    li.className = "frame";
    li.innerHTML = `
      <button class="frame__btn" data-index="${i}" aria-label="Open case study: ${p.name}">
        <div class="frame__still"><canvas aria-hidden="true"></canvas></div>
        <div class="frame__caption">
          <h3 class="frame__name">${p.name}</h3>
          <span class="frame__year">${p.year}</span>
          <p class="frame__line">${p.line}</p>
        </div>
      </button>`;
    track.appendChild(li);
  });
  document.querySelector(".reel__total").textContent = PROJECTS.length;

  const paintStills = () =>
    document.querySelectorAll(".frame__still canvas").forEach((cv, i) => drawStill(cv, PROJECTS[i], i));

  /* ------------------------------------------------------------------
     Hero: particle wordmark
     ------------------------------------------------------------------ */
  const hero = document.querySelector(".hero");
  const canvas = document.querySelector(".hero__canvas");
  const ctx = canvas.getContext("2d");
  let particles = [];
  let W = 0, H = 0, DPR = 1;
  const mouse = { x: -9999, y: -9999 };
  let heroProgress = 0;       // 0..1 as hero scrolls away
  let heroVisible = true;
  let introStart = 0;

  function lerpColor(c1, c2, t) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r1, g1, b1] = p(c1), [r2, g2, b2] = p(c2);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
  }
  const BUCKETS = 24;
  const bucketColors = Array.from({ length: BUCKETS }, (_, i) => {
    const t = i / (BUCKETS - 1);
    return t < 0.52 ? lerpColor(SPECTRUM[0], SPECTRUM[1], t / 0.52) : lerpColor(SPECTRUM[1], SPECTRUM[2], (t - 0.52) / 0.48);
  });

  function buildParticles() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = hero.clientWidth; H = hero.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Draw the wordmark offscreen and sample its pixels
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const o = off.getContext("2d");
    const narrow = W < 720;
    const big = Math.min(W * (narrow ? 0.36 : 0.3), H * 0.4);
    const small = big * (narrow ? 0.46 : 0.4);
    o.fillStyle = "#fff";
    o.textAlign = "center";
    o.textBaseline = "alphabetic";
    o.font = `600 ${small}px "Bricolage Grotesque", sans-serif`;
    o.fillText("made of", W / 2, H / 2 - big * 0.42);
    o.font = `800 ${big}px "Bricolage Grotesque", sans-serif`;
    o.fillText("next", W / 2, H / 2 + big * 0.5);

    const data = o.getImageData(0, 0, W, H).data;
    const step = Math.max(3, Math.round(Math.sqrt((W * H) / 26000)));
    const pts = [];
    let minY = H, maxY = 0;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 128) {
          pts.push([x, y]);
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    // centre the wordmark optically, slightly above the middle
    const shift = H * 0.46 - (minY + maxY) / 2;
    const prev = particles;
    particles = pts.map(([x, y], i) => {
      const old = prev[i];
      return {
        tx: x, ty: y + shift,
        x: old ? old.x : Math.random() * W,
        y: old ? old.y : Math.random() * H,
        vx: 0, vy: 0,
        size: step * (0.55 + Math.random() * 0.3),
        b: Math.min(BUCKETS - 1, Math.max(0, Math.floor((x / W) * BUCKETS + (Math.random() - 0.5) * 2))),
        delay: Math.random() * 0.9,
        seed: Math.random() * Math.PI * 2,
      };
    });
    // sort by colour bucket for batched fills
    particles.sort((a, b) => a.b - b.b);
  }

  function renderParticles(now) {
    if (!heroVisible) return requestAnimationFrame(renderParticles);
    const t = (now - introStart) / 1000;
    ctx.clearRect(0, 0, W, H);
    const scatter = heroProgress * heroProgress * Math.max(W, H) * 0.6;
    let current = -1;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const live = t > p.delay + 0.6; // staggered assembly after letterbox opens
      let tx = p.tx, ty = p.ty;
      if (scatter > 0) {
        tx += Math.cos(p.seed) * scatter * (0.4 + (p.seed % 1));
        ty += Math.sin(p.seed) * scatter * (0.4 + (p.seed % 1)) - scatter * 0.3;
      }
      if (live) {
        // spring to target
        p.vx += (tx - p.x) * 0.012;
        p.vy += (ty - p.y) * 0.012;
        // cursor repulsion
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 14000) {
          const f = (14000 - d2) / 14000;
          p.vx += dx * f * 0.09;
          p.vy += dy * f * 0.09;
        }
      } else {
        // gentle drift while waiting
        p.vx += Math.cos(t + p.seed) * 0.02;
        p.vy += Math.sin(t * 0.8 + p.seed) * 0.02;
      }
      p.vx *= 0.86; p.vy *= 0.86;
      p.x += p.vx; p.y += p.vy;

      if (p.b !== current) { current = p.b; ctx.fillStyle = bucketColors[current]; }
      ctx.globalAlpha = live ? 1 - heroProgress * 0.7 : 0.35;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(renderParticles);
  }

  function initParticles() {
    if (reduceMotion) return; // keep the static gradient headline
    document.documentElement.classList.add("has-particles");
    buildParticles();
    introStart = performance.now();
    requestAnimationFrame(renderParticles);

    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    hero.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });

    new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; }).observe(hero);

    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { buildParticles(); paintStills(); }, 200);
    });
  }

  /* ------------------------------------------------------------------
     Manifesto: split into words
     ------------------------------------------------------------------ */
  const manifesto = document.querySelector("[data-split]");
  const words = manifesto.textContent.trim().split(/\s+/);
  manifesto.setAttribute("aria-label", words.join(" "));
  manifesto.innerHTML = words.map((w) => `<span class="w" aria-hidden="true">${w}</span>`).join(" ");
  const wordEls = [...manifesto.querySelectorAll(".w")];

  /* ------------------------------------------------------------------
     Capabilities accordion
     ------------------------------------------------------------------ */
  document.querySelectorAll(".cap").forEach((cap) => {
    const btn = cap.querySelector(".cap__name");
    btn.addEventListener("click", () => {
      const open = !cap.classList.contains("is-open");
      document.querySelectorAll(".cap.is-open").forEach((c) => {
        c.classList.remove("is-open");
        c.querySelector(".cap__name").setAttribute("aria-expanded", "false");
      });
      cap.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  /* ------------------------------------------------------------------
     Cursor label over reel frames
     ------------------------------------------------------------------ */
  const label = document.querySelector(".cursor-label");
  if (window.matchMedia("(hover: hover)").matches) {
    const pointer = { x: -1, y: -1 };
    window.addEventListener("pointermove", (e) => {
      pointer.x = e.clientX; pointer.y = e.clientY;
      label.style.left = e.clientX + "px";
      label.style.top = e.clientY + "px";
    });
    // content moves under a still pointer while scrolling: re-check what's beneath it
    window.addEventListener("scroll", () => {
      const el = document.elementFromPoint(pointer.x, pointer.y);
      label.classList.toggle("is-on", !!(el && el.closest(".frame__btn")) && caseEl.hidden);
    }, { passive: true });
    track.addEventListener("pointerover", (e) => { if (e.target.closest(".frame__btn")) label.classList.add("is-on"); });
    track.addEventListener("pointerout", (e) => {
      if (!e.relatedTarget || !e.relatedTarget.closest(".frame__btn")) label.classList.remove("is-on");
    });
  }

  /* ------------------------------------------------------------------
     Case study overlay
     ------------------------------------------------------------------ */
  const caseEl = document.querySelector(".case");
  const caseStill = caseEl.querySelector(".case__still");
  let lastFocus = null;
  let lenis = null;

  function openCase(i) {
    const p = PROJECTS[i];
    lastFocus = document.activeElement;
    caseEl.querySelector(".case__meta").textContent = `${p.discipline}, ${p.year}`;
    caseEl.querySelector(".case__title").textContent = p.name;
    caseEl.querySelector(".case__summary").textContent = p.summary;
    caseEl.querySelector(".case__facts").innerHTML = p.facts
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    caseStill.innerHTML = "<canvas></canvas>";
    caseEl.hidden = false;
    caseEl.scrollTop = 0;
    drawStill(caseStill.querySelector("canvas"), p, i);
    document.body.style.overflow = "hidden";
    lenis && lenis.stop();
    label.classList.remove("is-on");

    if (hasGSAP && !reduceMotion) {
      gsap.timeline()
        .fromTo(caseEl, { clipPath: "inset(50% 0 50% 0)" }, { clipPath: "inset(0% 0 0% 0)", duration: 0.9, ease: "expo.inOut" })
        .from(caseEl.querySelector(".case__still canvas"), { scale: 1.25, duration: 1.4, ease: "expo.out" }, 0.2)
        .from(caseEl.querySelectorAll(".case__meta, .case__title, .case__summary, .case__facts div"),
          { y: 40, opacity: 0, stagger: 0.06, duration: 0.8, ease: "expo.out" }, 0.45);
    } else {
      caseEl.style.clipPath = "none";
    }
    caseEl.querySelector(".case__close").focus();
  }

  function closeCase() {
    const done = () => {
      caseEl.hidden = true;
      document.body.style.overflow = "";
      lenis && lenis.start();
      lastFocus && lastFocus.focus();
    };
    if (hasGSAP && !reduceMotion) {
      gsap.to(caseEl, { clipPath: "inset(50% 0 50% 0)", duration: 0.7, ease: "expo.inOut", onComplete: done });
    } else done();
  }

  track.addEventListener("click", (e) => {
    const btn = e.target.closest(".frame__btn");
    if (btn) openCase(+btn.dataset.index);
  });
  caseEl.querySelector(".case__close").addEventListener("click", closeCase);
  document.addEventListener("keydown", (e) => {
    if (caseEl.hidden) return;
    if (e.key === "Escape") closeCase();
    if (e.key === "Tab") { e.preventDefault(); caseEl.querySelector(".case__close").focus(); }
  });

  /* ------------------------------------------------------------------
     Scroll choreography
     ------------------------------------------------------------------ */
  function initScroll() {
    const current = document.querySelector(".reel__current");
    const frames = [...document.querySelectorAll(".frame")];

    if (!hasGSAP || reduceMotion) {
      document.documentElement.classList.add("no-pin");
      wordEls.forEach((w) => (w.style.opacity = 1));
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    if (typeof window.Lenis !== "undefined") {
      lenis = new Lenis({ lerp: 0.09 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
      document.querySelectorAll('a[href^="#"]').forEach((a) =>
        a.addEventListener("click", (e) => {
          const id = a.getAttribute("href");
          if (id.length > 1 && document.querySelector(id)) { e.preventDefault(); lenis.scrollTo(id, { duration: 1.6 }); }
          else if (id === "#") { e.preventDefault(); }
        })
      );
    }

    // Hero: particles scatter, lede drifts as you leave
    ScrollTrigger.create({
      trigger: hero, start: "top top", end: "bottom top", scrub: true,
      onUpdate: (st) => { heroProgress = st.progress; },
    });
    gsap.to(".hero__foot", { yPercent: -120, opacity: 0, ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "60% top", scrub: true } });

    // Manifesto: words light up in reading order
    ScrollTrigger.create({
      trigger: manifesto, start: "top 80%", end: "bottom 45%", scrub: true,
      onUpdate: (st) => {
        const lit = st.progress * wordEls.length;
        wordEls.forEach((w, i) => { w.style.opacity = Math.min(1, Math.max(0.16, lit - i + 0.16)); });
      },
    });

    // Reel: pin and roll horizontally
    const reel = document.querySelector(".reel");
    const distance = () => track.scrollWidth - window.innerWidth;
    const progressBar = document.querySelector(".reel__progress span");
    const stills = frames.map((f) => f.querySelector("canvas"));

    gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: reel,
        start: "top top",
        end: () => "+=" + distance(),
        pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (st) => {
          progressBar.style.transform = `scaleX(${st.progress})`;
          const idx = Math.min(frames.length - 1, Math.round(st.progress * (frames.length - 1)));
          current.textContent = idx + 1;
          // parallax inside each still: image travels slower than the frame
          stills.forEach((cv, i) => {
            const rel = st.progress * (frames.length - 1) - i;
            cv.style.translate = `${rel * -6}% 0`;
          });
        },
      },
    });

    // Contact headline: width axis opens as it arrives
    gsap.fromTo(".contact__title",
      { fontVariationSettings: '"wdth" 75, "opsz" 96', letterSpacing: "-0.06em" },
      { fontVariationSettings: '"wdth" 100, "opsz" 96', letterSpacing: "-0.035em", ease: "none",
        scrollTrigger: { trigger: ".contact", start: "top 85%", end: "center center", scrub: true } });
  }

  /* ------------------------------------------------------------------
     Opening sequence: the one orchestrated moment
     ------------------------------------------------------------------ */
  function intro() {
    document.body.classList.remove("is-loading");
    if (!hasGSAP || reduceMotion) {
      document.querySelectorAll(".letterbox").forEach((l) => l.remove());
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: "expo.inOut" } });
    tl.to(".letterbox--top", { yPercent: -88, duration: 1.4 }, 0.15)
      .to(".letterbox--bottom", { yPercent: 88, duration: 1.4 }, 0.15)
      .from(".nav", { opacity: 0, y: -20, duration: 1, ease: "expo.out" }, 1.1)
      .from(".hero__foot > *", { opacity: 0, y: 30, stagger: 0.1, duration: 1.1, ease: "expo.out" }, 1.3)
      .to(".letterbox", { opacity: 0, duration: 0.8, ease: "power2.out", onComplete: () => document.querySelectorAll(".letterbox").forEach((l) => l.remove()) }, 2.6);
  }

  /* ------------------------------------------------------------------
     Boot once fonts are ready (particles sample the real typeface)
     ------------------------------------------------------------------ */
  document.querySelector("[data-year]").textContent = new Date().getFullYear();
  const fontsReady = document.fonts
    ? Promise.race([
        Promise.all([
          document.fonts.load('800 100px "Bricolage Grotesque"'),
          document.fonts.load('600 100px "Bricolage Grotesque"'),
        ]),
        new Promise((r) => setTimeout(r, 2500)),
      ])
    : Promise.resolve();

  fontsReady.then(() => {
    paintStills();
    initParticles();
    initScroll();
    intro();
    if (hasGSAP) ScrollTrigger.refresh();
  });
})();
