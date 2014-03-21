window.onload = function () {
    var loader = new CommutesAndRent.Loader();
};

var CommutesAndRent;
(function (CommutesAndRent) {
    var Loader = (function () {
        function Loader() {
            var map = new CommutesAndRent.MapView();
            var chart = new CommutesAndRent.Chart(function () {
                return map.getSelectedStation();
            });
        }
        return Loader;
    })();
    CommutesAndRent.Loader = Loader;
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var MapView = (function () {
        function MapView() {
            this.selectedStation = "";
            this.buildMap();
            this.placeStationMarkers();
        }
        MapView.prototype.getSelectedStation = function () {
            return this.selectedStation;
        };

        MapView.prototype.buildMap = function () {
            this.map = L.map("map").setView(MapView.defaultCenter, MapView.defaultZoom);
            var tileLayer = new L.TileLayer(MapView.mapTileURLTemplate, { mapid: MapView.mapId });
            tileLayer.addTo(this.map);
        };

        MapView.prototype.placeStationMarkers = function () {
            var _this = this;
            $.getJSON("preprocessor-output/processed-locations/locations.json", function (data) {
                return _this.addStationLocations(data);
            });
        };

        MapView.prototype.addStationLocations = function (data) {
            var _this = this;
            for (var i = 0; i < data.length; i++) {
                var name = data[i].name;
                var latitude = data[i].latitude;
                var longitude = data[i].longitude;

                var marker = L.marker(new L.LatLng(latitude, longitude), 10);
                this.map.addLayer(marker);

                marker.stationName = name;

                marker.bindPopup(name);
                marker.on("click", function (e) {
                    return _this.updateSelection(e);
                });
            }
        };

        MapView.prototype.updateSelection = function (event) {
            var marker = event.target;
            this.selectedStation = marker.stationName;
        };
        MapView.mapTileURLTemplate = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        MapView.mapId = "coffeetable.hinlda0l";

        MapView.defaultCenter = new L.LatLng(51.505, -0.09);
        MapView.defaultZoom = 13;
        return MapView;
    })();
    CommutesAndRent.MapView = MapView;
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var Chart = (function () {
        function Chart(getSelectedStation) {
            var _this = this;
            this.getSelectedStation = getSelectedStation;
            this.initializeGraphic();

            $.when(this.loadRentData("two-bedroom-rents.json"), this.loadDepartureData("0900", "Baker Street")).done(function () {
                return _this.updateGraphic();
            });
        }
        Chart.prototype.loadRentData = function (filename) {
            var _this = this;
            var filepath = Chart.rentStatsFolder + filename;

            return $.getJSON(filepath, function (data) {
                _this.rentStats = data;
                return null;
            });
        };

        Chart.prototype.loadDepartureData = function (time, stationName) {
            var _this = this;
            var filepath = Chart.departureTimesFolder + time + "/" + stationName + ".json";

            return $.getJSON(filepath, function (data) {
                _this.departureTimes = data;
                return null;
            });
        };

        Chart.prototype.initializeGraphic = function () {
            this.chartGraphic = d3.select("#chart").append("svg").attr({ width: "100%", height: "100%", overflow: "scroll" });
        };

        Chart.prototype.updateGraphic = function () {
            this.chartGraphic.selectAll("text").data(this.rentStats).enter().append("text").text(function (d) {
                return d.name;
            }).attr("y", function (d, i) {
                return 20 * i;
            });

            this.chartGraphic.attr("height", this.rentStats.length * 20);
        };

        Chart.prototype.drawRent = function (rentStat, index) {
        };
        Chart.rentStatsFolder = "preprocessor-output/processed-rents/";
        Chart.departureTimesFolder = "preprocessor-output/processed-departure-times/";
        return Chart;
    })();
    CommutesAndRent.Chart = Chart;
})(CommutesAndRent || (CommutesAndRent = {}));
//# sourceMappingURL=commutes-and-rent.js.map
