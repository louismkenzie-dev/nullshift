/* Nullshift Quote — embed loader.
 * <script src="https://nullshift.co.uk/widget.js" data-nullshift-quote="qw_xxx" async></script>
 * Renders an auto-resizing iframe where the tag sits. Nothing else touches the host page. */
(function () {
  var scripts = document.querySelectorAll("script[data-nullshift-quote]");
  for (var i = 0; i < scripts.length; i++) {
    var el = scripts[i];
    if (el.getAttribute("data-ns-mounted")) continue;
    el.setAttribute("data-ns-mounted", "1");
    var key = el.getAttribute("data-nullshift-quote");
    var origin = (function () {
      try { return new URL(el.src).origin; } catch (e) { return "https://nullshift.co.uk"; }
    })();
    var iframe = document.createElement("iframe");
    iframe.src = origin + "/w/" + encodeURIComponent(key) + "?embed=1&ref=" + encodeURIComponent(location.href);
    iframe.title = "Get a price";
    iframe.style.cssText = "width:100%;max-width:" + (el.getAttribute("data-max-width") || "520px") + ";height:560px;border:0;display:block;margin:0 auto;background:transparent;";
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("allowtransparency", "true");
    el.parentNode.insertBefore(iframe, el.nextSibling);
    window.addEventListener("message", function (ev) {
      if (ev.origin !== origin || !ev.data || ev.data.type !== "ns-quote-size" || ev.data.key !== key) return;
      iframe.style.height = Math.max(320, ev.data.height + 8) + "px";
    });
  }
})();
