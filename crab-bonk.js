/*!
 * Crab Bonk (vanilla JS, no deps)
 * - Happy crabs until bonked (then sad + tear)
 * - Club hotspot alignment configurable
 * - Shows "BONK!" text when bonked
 */
(function () {
  "use strict";

 const CFG = Object.assign(
   {
     assetBase: "./crab-bonk-assets/",
     spawnEveryMs: 2900,
     maxCrabs: 3,
     crabSize: 100,
     laneHeight: 220,
     speedMin: 25,
     speedMax: 55,
     fleeSpeed: 420,
     fleeDownSpeed: 280,
     frameMs: 140,
     bonkCooldownMs: 250,
     bonkStunMs: 520,
     tearHoldExtraMs: 700,
     clubSize: 90,

     // Club cursor alignment: where the "bonk point" is inside the club image.
     // Increase hotspotY to move the club *up* relative to the cursor.
     clubHotspotX: 46,
     clubHotspotY: 20,

     zIndex: 9999
   },
   (window.CrabBonkConfig || {})
 );

 const HAPPY_FRAMES = [
   "crab_happy_0.png",
   "crab_happy_1.png",
   "crab_happy_2.png",
   "crab_happy_3.png"
 ].map(f => CFG.assetBase + f);

 const SAD_FRAMES = [
   "crab_sad_0.png",
   "crab_sad_1.png",
   "crab_sad_2.png",
   "crab_sad_3.png"
 ].map(f => CFG.assetBase + f);

 const TEAR = CFG.assetBase + "crab_tear.png";
 const CLUB = CFG.assetBase + "club.png";

 function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
 function rand(a, b) { return a + Math.random() * (b - a); }

 function injectCss() {
   if (document.getElementById("crab-bonk-css")) return;
   const css = `
   #crab-bonk-layer {
   position: fixed;
   left: 0;
   bottom: 0;
   width: 100%;
   height: ${CFG.laneHeight}px;
   z-index: ${CFG.zIndex};
   pointer-events: none;
   overflow: hidden;
   }
   .crab-bonk-crab {
     position: absolute;
     bottom: 0;
     width: ${CFG.crabSize}px;
     height: ${CFG.crabSize}px;
     background-repeat: no-repeat;
     background-size: contain;
     transform-origin: 50% 90%;
     pointer-events: auto;
     user-select: none;
     -webkit-user-select: none;
   }
   .crab-bonk-crab:hover { filter: drop-shadow(0 4px 4px rgba(0,0,0,.25)); }

   /* Tear: below the eye so it won't look like a pupil "dot" */
   .crab-bonk-crab .crab-bonk-tear {
     position: absolute;
     left: 62%;
     top: 52%;
     width: 28%;
     height: 28%;
     background: url("${TEAR}") no-repeat;
     background-size: contain;
     opacity: 0;
     pointer-events: none;
   }
   .crab-bonk-crab.bonked .crab-bonk-tear {
     opacity: 1;
     animation: crabTearWobble 260ms ease-in-out infinite;
   }
   @keyframes crabTearWobble {
     0%   { transform: translateY(0) rotate(-3deg); }
     50%  { transform: translateY(2px) rotate(3deg); }
     100% { transform: translateY(0) rotate(-3deg); }
   }

   /* BONK text */
   .crab-bonk-crab .crab-bonk-bonktext{
     position: absolute;
     left: 50%;
     top: -6%;
     transform: translate(-50%, 8px) scale(.8) rotate(-6deg);
     opacity: 0;
     pointer-events: none;
     font: 800 22px/1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
     letter-spacing: .5px;
     color: #fff;
     text-shadow: 0 2px 0 rgba(0,0,0,.35), 0 6px 12px rgba(0,0,0,.25);
     filter: drop-shadow(0 6px 6px rgba(0,0,0,.2));
   }
   .crab-bonk-crab .crab-bonk-bonktext.show{
     animation: bonkPop 520ms ease-out forwards;
   }
   @keyframes bonkPop{
     0%   { opacity: 0; transform: translate(-50%, 10px) scale(.8) rotate(-6deg); }
     12%  { opacity: 1; transform: translate(-50%, 0px)  scale(1.05) rotate(6deg); }
     100% { opacity: 0; transform: translate(-50%, -28px) scale(1.15) rotate(0deg); }
   }

   #crab-bonk-club {
   position: fixed;
   width: ${CFG.clubSize}px;
   height: ${CFG.clubSize}px;
   left: 0;
   top: 0;
   transform: translate(-9999px, -9999px);
   background: url("${CLUB}") no-repeat;
   background-size: contain;
   pointer-events: none;
   z-index: ${CFG.zIndex + 1};
   filter: drop-shadow(0 6px 6px rgba(0,0,0,.25));
   }
   #crab-bonk-club.swing {
   animation: clubSwing 140ms ease-out;
   }
   @keyframes clubSwing {
     0%   { transform: translate(var(--x), var(--y)) rotate(-10deg) scale(1); }
     100% { transform: translate(var(--x), var(--y)) rotate(35deg) scale(1.02); }
   }
   `;
   const style = document.createElement("style");
   style.id = "crab-bonk-css";
   style.textContent = css;
   document.head.appendChild(style);
 }

 class Crab {
   constructor(layer) {
     this.layer = layer;
     this.el = document.createElement("div");
     this.el.className = "crab-bonk-crab";
     this.frames = HAPPY_FRAMES;
     this.el.style.backgroundImage = `url("${this.frames[0]}")`;

     const tear = document.createElement("div");
     tear.className = "crab-bonk-tear";
     this.el.appendChild(tear);

     const bonkText = document.createElement("div");
     bonkText.className = "crab-bonk-bonktext";
     bonkText.textContent = "BONK!";
     this.el.appendChild(bonkText);
     this.bonkText = bonkText;

     this.size = CFG.crabSize;
     this.x = rand(0, Math.max(0, window.innerWidth - this.size));
     this.y = 0;

     const dir = Math.random() < 0.5 ? -1 : 1;
     this.vx = dir * rand(CFG.speedMin, CFG.speedMax);
     this.vy = 0;

     this.state = "walk"; // walk | stun | flee | dead
     this.stunLeft = 0;
     this.fleeSign = 1;

     this.frame = Math.floor(rand(0, 4));
     this.frameT = 0;

     this.lastBonkAt = 0;

     this._bind();
     this.layer.appendChild(this.el);
     this._render();
   }

   _bind() {
     this.el.addEventListener("pointerenter", () => showClub(true));
     this.el.addEventListener("pointerleave", () => showClub(false));
     this.el.addEventListener("pointerdown", (e) => {
       e.preventDefault();
       const now = performance.now();
       if (now - this.lastBonkAt < CFG.bonkCooldownMs) return;
       this.lastBonkAt = now;
       bonkAt(e.clientX, e.clientY);
       this.bonk(e.clientX, e.clientY);
     }, { passive: false });
   }

   bonk(mx, my) {
     if (this.state !== "walk") return;

     this.state = "stun";
     this.stunLeft = CFG.bonkStunMs;

     const away = (this.x + this.size / 2) - mx;
     this.fleeSign = away === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(away);

     this.vx = 0;
     this.vy = 0;

     // switch to sad frames + tear
     this.frames = SAD_FRAMES;
     this.el.classList.add("bonked");

     // show BONK text (restart animation)
     if (this.bonkText) {
       this.bonkText.classList.remove("show");
       void this.bonkText.offsetWidth;
       this.bonkText.classList.add("show");
     }

     this.el.style.transition = "transform 90ms ease-out";
     this.el.style.transform = "scale(0.94) rotate(" + (this.fleeSign * -6) + "deg)";
     setTimeout(() => {
       if (!this.el) return;
       this.el.style.transform = "scale(1) rotate(0deg)";
       this.el.style.transition = "";
     }, 100);

     const hideAfter = CFG.bonkStunMs + CFG.tearHoldExtraMs;
     setTimeout(() => this.el && this.el.classList.remove("bonked"), hideAfter);
   }

   update(dt) {
     if (this.state === "dead") return;

     this.frameT += dt;
     if (this.frameT >= CFG.frameMs) {
       this.frameT = 0;
       this.frame = (this.frame + 1) % 4;
       this.el.style.backgroundImage = `url("${this.frames[this.frame]}")`;
     }

     if (this.state === "walk") {
       this.x += this.vx * (dt / 1000);

       if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx); }
       if (this.x > window.innerWidth - this.size) {
         this.x = Math.max(0, window.innerWidth - this.size);
         this.vx = -Math.abs(this.vx);
       }
       this.el.style.transform = (this.vx < 0 ? "scaleX(-1)" : "scaleX(1)");
     } else if (this.state === "stun") {
       this.el.style.transform = (this.fleeSign < 0 ? "scaleX(-1)" : "scaleX(1)");
       this.stunLeft -= dt;
       if (this.stunLeft <= 0) {
         this.state = "flee";
         this.vx = this.fleeSign * CFG.fleeSpeed;
         this.vy = CFG.fleeDownSpeed;
       }
     } else if (this.state === "flee") {
       this.x += this.vx * (dt / 1000);
       this.y += this.vy * (dt / 1000);
       this.el.style.transform = (this.vx < 0 ? "scaleX(-1)" : "scaleX(1)");
       if (this.y > CFG.laneHeight + this.size) { this.destroy(); return; }
     }

     this._render();
   }

   _render() {
     this.el.style.left = `${Math.round(this.x)}px`;
     this.el.style.bottom = `${Math.round(-this.y)}px`;
   }

   destroy() {
     this.state = "dead";
     if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
     this.el = null;
   }
 }

 let layer, club;
 let crabs = [];
 let lastT = 0;
 let spawnTimer = 0;
 let clubVisible = false;
 let mouseX = -9999, mouseY = -9999;

 function ensureDom() {
   injectCss();
   if (!layer) {
     layer = document.createElement("div");
     layer.id = "crab-bonk-layer";
     document.body.appendChild(layer);
   }
   if (!club) {
     club = document.createElement("div");
     club.id = "crab-bonk-club";
     document.body.appendChild(club);
   }
 }

 function showClub(on) {
   clubVisible = !!on;
   if (!clubVisible) {
     club.style.transform = "translate(-9999px, -9999px)";
   } else {
     moveClub(mouseX, mouseY);
   }
 }

 function moveClub(x, y) {
   mouseX = x; mouseY = y;
   if (!clubVisible) return;

   const cx = x - CFG.clubHotspotX;
   const cy = y - CFG.clubHotspotY;

   club.style.setProperty("--x", cx + "px");
   club.style.setProperty("--y", cy + "px");
   club.style.transform = `translate(${cx}px, ${cy}px)`;
 }

 function bonkAt(x, y) {
   moveClub(x, y);
   club.classList.remove("swing");
   void club.offsetWidth;
   club.classList.add("swing");
 }

 function spawnCrab() {
   if (!layer) return;
   if (crabs.length >= CFG.maxCrabs) return;
   crabs.push(new Crab(layer));
 }

 function tick(t) {
   if (!lastT) lastT = t;
   const dt = t - lastT;
   lastT = t;

   spawnTimer += dt;
   if (spawnTimer >= CFG.spawnEveryMs) { spawnTimer = 0; spawnCrab(); }

   for (let i = crabs.length - 1; i >= 0; i--) {
     const c = crabs[i];
     if (!c.el) { crabs.splice(i, 1); continue; }
     c.update(dt);
   }
   requestAnimationFrame(tick);
 }

 function init() {
   if (window.__crabBonkInit) return;
   window.__crabBonkInit = true;

   ensureDom();

   document.addEventListener("pointermove", (e) => moveClub(e.clientX, e.clientY), { passive: true });
   document.addEventListener("pointerdown", (e) => { if (clubVisible) bonkAt(e.clientX, e.clientY); }, { passive: true });

   window.addEventListener("resize", () => {
     for (const c of crabs) c.x = clamp(c.x, 0, Math.max(0, window.innerWidth - c.size));
   });

     requestAnimationFrame(tick);
 }

 if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
 else init();
})();
