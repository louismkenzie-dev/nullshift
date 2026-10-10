/* Nullshift Plans — embed loader.
 * <script src="https://nullshift.co.uk/plan.js" data-nullshift-plan="pl_xxx" async></script> */
(function () {
  var scripts = document.querySelectorAll("script[data-nullshift-plan]");
  for (var i = 0; i < scripts.length; i++) {
    var el = scripts[i];
    if (el.getAttribute("data-ns-mounted")) continue;
    el.setAttribute("data-ns-mounted", "1");
    var key = el.getAttribute("data-nullshift-plan");
    var origin = (function () { try { return new URL(el.src).origin; } catch (e) { return "https://nullshift.co.uk"; } })();
    var iframe = document.createElement("iframe");
    iframe.src = origin + "/p/" + encodeURIComponent(key) + "?embed=1&ref=" + encodeURIComponent(location.href);
    iframe.title = "Get your free plan";
    iframe.style.cssText = "width:100%;max-width:" + (el.getAttribute("data-max-width") || "560px") + ";height:520px;border:0;display:block;margin:0 auto;background:transparent;";
    iframe.setAttribute("loading", "lazy");
    el.parentNode.insertBefore(iframe, el.nextSibling);
    window.addEventListener("message", function (ev) {
      if (ev.origin !== origin || !ev.data || ev.data.type !== "ns-plan-size" || ev.data.key !== key) return;
      iframe.style.height = Math.max(320, ev.data.height + 8) + "px";
    });
  }
})();
