/**
 * Uplink Support widget — drop-in, dependency-free, embeddable on any product site:
 *   <script src="https://support.uplink.net.au/support-widget.js"
 *           data-product="hosting" defer></script>
 *
 * Renders a launcher bubble → panel with a KB-grounded deflection chat and a
 * "Talk to a human" path that opens a ticket. Talks to /api/support-widget
 * (CORS-enabled). No cookies, no PII stored client-side.
 */
(function () {
	"use strict";
	var s = document.currentScript || (function () { var a = document.getElementsByTagName("script"); return a[a.length - 1]; })();
	var PRODUCT = (s && s.getAttribute("data-product")) || "general";
	var ENDPOINT = (s && s.getAttribute("data-endpoint")) || "https://support.uplink.net.au/api/support-widget";
	var ACCENT = (s && s.getAttribute("data-accent")) || "#991b1b";
	var TITLE = (s && s.getAttribute("data-title")) || "Support";

	var css = "" +
		".uws-launch{position:fixed;bottom:20px;right:20px;z-index:2147483000;background:" + ACCENT + ";color:#fff;border:none;border-radius:999px;padding:12px 18px;font:600 14px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25);cursor:pointer}" +
		/* Phone widths: the full "💬 Support" lozenge is wide enough to sit on the
		   right half of full-width form controls as they scroll past (it covered
		   the plan selector on the Shopkit signup page). Icon-only circle instead. */
		"@media (max-width:480px){.uws-launch{width:48px;height:48px;padding:0;font-size:20px;line-height:48px;text-align:center}.uws-launch .uws-label{display:none}}" +
		".uws-panel{position:fixed;bottom:20px;right:20px;z-index:2147483001;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 40px);background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden;font:14px system-ui,sans-serif;color:#0f0f0f}" +
		".uws-hd{background:" + ACCENT + ";color:#fff;padding:14px 16px;font-weight:700;display:flex;justify-content:space-between;align-items:center}" +
		".uws-hd button{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer}" +
		".uws-body{flex:1;overflow-y:auto;padding:14px;background:#faf8f5}" +
		".uws-msg{margin:0 0 10px;line-height:1.5;white-space:pre-wrap}" +
		".uws-bot{background:#fff;border:1px solid #eee;border-radius:12px;padding:9px 12px}" +
		".uws-me{background:" + ACCENT + "18;border-radius:12px;padding:9px 12px;margin-left:32px}" +
		".uws-ft{border-top:1px solid #eee;padding:10px;display:flex;gap:8px}" +
		".uws-ft input,.uws-ft textarea{flex:1;border:1px solid #ddd;border-radius:10px;padding:9px;font:14px system-ui;resize:none}" +
		".uws-ft button{background:" + ACCENT + ";color:#fff;border:none;border-radius:10px;padding:0 14px;font-weight:600;cursor:pointer}" +
		".uws-link{display:block;text-align:center;font-size:12px;color:#666;padding:8px;cursor:pointer}" +
		".uws-form{padding:14px;display:none;flex-direction:column;gap:8px;background:#faf8f5}" +
		".uws-form input,.uws-form textarea{border:1px solid #ddd;border-radius:10px;padding:9px;font:14px system-ui}" +
		".uws-form button{background:" + ACCENT + ";color:#fff;border:none;border-radius:10px;padding:10px;font-weight:600;cursor:pointer}";
	var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

	var launch = document.createElement("button");
	launch.className = "uws-launch";
	launch.appendChild(document.createTextNode("💬"));
	var launchLabel = document.createElement("span");
	launchLabel.className = "uws-label";
	launchLabel.textContent = " " + TITLE;
	launch.appendChild(launchLabel);
	launch.setAttribute("aria-label", TITLE);
	var panel = document.createElement("div"); panel.className = "uws-panel";
	panel.innerHTML =
		'<div class="uws-hd"><span>' + TITLE + '</span><button aria-label="Close">×</button></div>' +
		'<div class="uws-body"></div>' +
		'<div class="uws-link">Talk to a human →</div>' +
		'<div class="uws-ft"><input type="text" placeholder="Ask a question…" /><button>Send</button></div>' +
		'<div class="uws-form">' +
		'<input class="uws-email" type="email" placeholder="Your email" />' +
		'<textarea class="uws-message" rows="4" placeholder="How can we help?"></textarea>' +
		'<div class="uws-ts"></div>' +
		'<button class="uws-submit">Send to support</button></div>';
	document.body.appendChild(launch); document.body.appendChild(panel);

	var bodyEl = panel.querySelector(".uws-body");
	var input = panel.querySelector(".uws-ft input");
	var sendBtn = panel.querySelector(".uws-ft button");
	var human = panel.querySelector(".uws-link");
	var form = panel.querySelector(".uws-form");
	var ft = panel.querySelector(".uws-ft");
	var history = [];
	var greeted = false;

	function open() {
		panel.style.display = "flex"; launch.style.display = "none";
		if (!greeted) { greeted = true; addBot("Hi! Ask me anything, or tap “Talk to a human” to open a ticket."); }
		input.focus();
	}
	function close() { panel.style.display = "none"; launch.style.display = "block"; }
	launch.onclick = open;
	panel.querySelector(".uws-hd button").onclick = close;

	function addMsg(text, cls) {
		var d = document.createElement("div"); d.className = "uws-msg " + cls;
		var inner = document.createElement("div"); inner.className = cls === "uws-me" ? "uws-me" : "uws-bot";
		inner.textContent = text; d.appendChild(inner); bodyEl.appendChild(d);
		bodyEl.scrollTop = bodyEl.scrollHeight; return inner;
	}
	function addBot(t) { return addMsg(t, "uws-bot-wrap"); }
	function addMe(t) { return addMsg(t, "uws-me"); }

	async function send() {
		var q = input.value.trim(); if (!q) return;
		input.value = ""; addMe(q); history.push({ role: "user", content: q });
		var out = addBot(""); var acc = "";
		try {
			var res = await fetch(ENDPOINT, {
				method: "POST", headers: { "content-type": "application/json" },
				body: JSON.stringify({ mode: "chat", productKind: PRODUCT, messages: history }),
			});
			if (!res.ok || !res.body) { out.textContent = "Sorry — please tap “Talk to a human”."; return; }
			var reader = res.body.getReader(); var dec = new TextDecoder();
			while (true) { var r = await reader.read(); if (r.done) break; acc += dec.decode(r.value, { stream: true }); out.textContent = acc; bodyEl.scrollTop = bodyEl.scrollHeight; }
			history.push({ role: "assistant", content: acc });
		} catch (e) { out.textContent = "Sorry — please tap “Talk to a human”."; }
	}
	sendBtn.onclick = send;
	input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });

	// ── Turnstile ────────────────────────────────────────────────────────────────
	// Only the TICKET path is challenged; chat sends no email, so a customer asking a
	// question is never interrupted. The script is loaded lazily on "Talk to a human"
	// so chat-only visitors never fetch it at all.
	// ⚠ The site key is public by design (it ships in the page). The SECRET lives only
	// on the server. Pair created 2026-08-20; hostnames must include every host that
	// renders this widget or the challenge silently refuses to appear.
	var TS_SITE_KEY = "0x4AAAAAAEWQzwocjINPGxcY";
	var SUPPORT_EMAIL = "support@uplink.net.au";
	var tsWidgetId = null, tsUnavailable = false;

	function tsLoad(cb) {
		if (window.turnstile) return cb(true);
		var sc = document.createElement("script");
		sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
		sc.async = true; sc.defer = true;
		sc.onload = function () { cb(true); };
		sc.onerror = function () { cb(false); };
		document.head.appendChild(sc);
	}

	function tsRender() {
		var el = form.querySelector(".uws-ts");
		if (!el || tsWidgetId !== null) return;
		tsLoad(function (ok) {
			if (!ok || !window.turnstile) {
				// ⚠ Never a dead end: if the challenge cannot load, hand over the address.
				tsUnavailable = true;
				el.innerHTML = '<div style="font:12px system-ui;color:#7f1d1d;line-height:1.4">' +
					"Security check unavailable — please email " +
					'<a href="mailto:' + SUPPORT_EMAIL + '" style="color:#7f1d1d">' + SUPPORT_EMAIL + "</a> and we'll pick it up straight away.</div>";
				return;
			}
			try { tsWidgetId = window.turnstile.render(el, { sitekey: TS_SITE_KEY }); }
			catch (e) { tsUnavailable = true; }
		});
	}

	human.onclick = function () {
		ft.style.display = "none"; human.style.display = "none"; form.style.display = "flex";
		tsRender();
	};
	panel.querySelector(".uws-submit").onclick = async function () {
		var email = form.querySelector(".uws-email").value.trim();
		var message = form.querySelector(".uws-message").value.trim();
		if (!email || !message) { alert("Please enter your email and a message."); return; }
		var tsToken = (window.turnstile && tsWidgetId !== null) ? window.turnstile.getResponse(tsWidgetId) : "";
		if (!tsToken) {
			alert(tsUnavailable
				? "The security check couldn't load. Please email " + SUPPORT_EMAIL + " and we'll pick it up straight away."
				: "Please complete the security check below, then send.");
			return;
		}
		var btn = panel.querySelector(".uws-submit"); btn.disabled = true; btn.textContent = "Sending…";
		try {
			var res = await fetch(ENDPOINT, {
				method: "POST", headers: { "content-type": "application/json" },
				body: JSON.stringify({ mode: "ticket", productKind: PRODUCT, email: email, message: message, "cf-turnstile-response": tsToken }),
			});
			var data = await res.json();
			form.style.display = "none"; bodyEl.style.display = "block";
			if (data && data.ok) addBot(data.confirmed === false
				? "Thanks — we've opened ticket " + data.ref + ". We'll be in touch shortly."
				: "Thanks — we've opened ticket " + data.ref + " and emailed you a confirmation. We'll be in touch shortly.");
			else { addBot("Sorry, that didn't go through. Please email " + SUPPORT_EMAIL + " directly."); try { if (window.turnstile && tsWidgetId !== null) window.turnstile.reset(tsWidgetId); } catch (e) {} }
		} catch (e) {
			form.style.display = "none"; addBot("Sorry, that didn't go through. Please email support directly.");
		}
	};
})();
