meta: {{}}

<feature
  id="{{templateName}}"
  name="Twitter Video Embedder"
  version="0.1"
  description="{{templateName}} adds video embeds to YouTube links on Twitter."
  previewimage="http://jetpack.s3.amazonaws.com/twitter/preview.jpg">

<!-- SAMPLE CONTENT SCRIPT JETPACK FEATURE -->
<!-- For more help, read the API documentation at: https://wiki.mozilla.org/Labs/Jetpack/API -->
  <script><![CDATA[

    function install() {
      // The addEmbedsToTwitter function would be injected and run in matched
      // pages. Referencing any variables outside this function wouldn't work.
      let addEmbedsToTwitter = function() {
        let template =
         '<object width="425" height="373">' +
         '  <param name="movie" value="http://www.youtube.com/v/%s&rel=0&border=0"></param>' +
         '  <param name="wmode" value="transparent"></param>' +
         '  <embed src="http://www.youtube.com/v/%s&rel=0&border=0"' +
         ' type="application/x-shockwave-flash" wmode="transparent"' +
         ' width="425" height="373"></embed></object>';


        $("a").each(function() {
          let url = $(this).attr("href")

    // some of the youtube links contain ... at the end so ignore them.
   if (url.indexOf('youtube.com/watch?v=') < 0 ||
        (url.charAt(url.length-1) == ".")) {
      return;
     }

          let videoId = this.href.match('=([a-zA-Z_0-9\-]+)')[1];
          let div = document.createElement("div");

          div.innerHTML = template.replace(/%s/g, videoId);
          $(this).before(div);
        });
      }

      // Go to http://search.twitter.com/search?q=youtube+watch to see
      // the results.  Patterns should contain regular expressions in string
      // format.
      Jetpack.Content.addLoadHandler({
        patterns: ["twitter.com/"], filter: addEmbedsToTwitter });
    };

  ]]></script>
</feature>