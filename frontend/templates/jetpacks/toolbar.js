meta: {{}}

<feature id="{{templateName}}" name="Weather Demo" version="0.1"
  description="{{templateName}} sidebar and toolbar button demo using Weather."
  previewimage="http://jetpack.s3.amazonaws.com/weather/preview.jpg">

<!-- SAMPLE TOOLBAR JETPACK FEATURE -->
<!-- For more help, read the API documentation at: https://wiki.mozilla.org/Labs/Jetpack/API -->
  <require src="http://jetpack.s3.amazonaws.com/weather/icon.png" />

  <script require="false" src="http://j.maxmind.com/app/geoip.js" />
  <script><![CDATA[        
    let weatherURL;

    function toTwoDigits(aNumber) {
      return (aNumber < 10) ? "0" + aNumber : String(aNumber);
    }

    function isToday(aDay) {
      let dayIndex = new Date().getDay();
      let days = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];
      let isToday = false;

      if (dayIndex < days.length && aDay == days[dayIndex]) {
        isToday = true;
      }

      return isToday;
    }

    function updateTime() {
      let date = new Date();
      let time =
        toTwoDigits(date.getHours()) + ":" + toTwoDigits(date.getMinutes());

      if ($("#time").text() != time) {
        $("#time").text(time);
        // reload sidebars.
        Jetpack.UI.Sidebars.update({ id : "weathersb" });

        Jetpack.Logger.log({ message: "Sidebar Update." });
      }
    }

    function updateWeather() {
      Jetpack.Logger.log({ message: "updateTime()" });

      $.get(
        weatherURL,
        function(xml) {
          let date = new Date();

          $("#last-update-time").text(
            toTwoDigits(date.getHours()) + ":" +
            toTwoDigits(date.getMinutes()));
          $("#forecast").empty();

          $(xml).find("current_conditions").each(function() {
            let title = "<br/><Strong>Current</strong><br/>";
            let content =
              "<div style='float: left;  width: 50px;'>" +
            "<img style='border: 1px solid #606060' " +
            "src='http://www.google.com/" +
            $(this).find("icon").attr("data") + "'></div>" +
            "<div>Feels Like: " + $(this).find("temp_f").attr("data") +
            "&deg;F<br/>" +
            $(this).find("humidity").attr("data") + "<br/>" +
            $(this).find("wind_condition").attr("data") + "</div>";

            $("<div/>").html(title).appendTo("#forecast");
            $("<div/>").html(content).appendTo("#forecast");
          });

          $(xml).find("forecast_conditions").each(function(i, entry) {
            let day = $(this).find("day_of_week").attr("data");
            let title;
            let content;

            if (i == 0) {
              day = isToday(day) ? "Today" : day;
            }
            title = "<br/><Strong>" + day + "</strong><br/>";
            content =
              "<div style='float: left;  width: 50px;'>" +
              "<img style='border: 1px solid #606060' " +
              "src='http://www.google.com/" +
              $(this).find("icon").attr("data") + "'></div>" +
              "<div>" + $(this).find("condition").attr("data") + "<br/>" +
              "High: " + $(this).find("high").attr("data") + "&deg;F<br/>" +
              "Low: " + $(this).find("low").attr("data") + "&deg;F</div>";

            $("<div/>").html(title).appendTo("#forecast");
            $("<div/>").html(content).appendTo("#forecast");
          });
        });
    }

    function install() {
      Jetpack.Logger.log("install()");

      let city = geoip_city();
      let country = geoip_country_name();

      weatherURL =
      "http://www.google.com/ig/api?weather=" +
      encodeURIComponent(city) + "," + encodeURIComponent(country);

      $("#location").text(city + ", " + country);

      // add the sidebar.
      Jetpack.UI.Sidebars.create({
        id: "weathersb", name: "Weather Sidebar",
        content: $("#sidebar-content")[0] });

      // add the toolbar button.
      Jetpack.UI.Toolbars.Main.create(
       { id: "weather-toggle", name: "Weather", icon: "icon.png",
         command: "Jetpack.UI.Sidebars.toggle('weathersb')" });

      // update data and trigger the regular refresh intervals.
      updateTime();
      window.setInterval(function() { updateTime(); }, 1000);

      updateWeather();
      window.setInterval(function() { updateWeather(); }, 3600000);
    }
  ]]></script>

  <div id="sidebar-content"
    style="background-color: #FFFFFF; height: 100%;">
    <div style="padding: 8px; font-size: 12px;">
      <span style="font-weight: bold" id="location"></span>
      <div id="forecast"></div>

      <br/>
      <p>Last Weather Update: <strong id="last-update-time"></strong></p>
      <p>Current Time: <strong id="time"></strong></p>
    </div>
  </div>
</feature>