window.onload = function () {
    new CommutesAndRent.Map();
    new CommutesAndRent.ChartController();
};

var CommutesAndRent;
(function (CommutesAndRent) {
    var Map = (function () {
        function Map() {
            var _this = this;
            this.mapObject = Map.buildMap();

            $.getJSON(Map.locationDataPath, function (data) {
                return Map.addMarkers(_this.mapObject, data);
            });
        }
        Map.buildMap = function () {
            var map = L.map("map").setView(Map.defaultCenter, Map.defaultZoom);

            new L.TileLayer(Map.mapTileURLTemplate, { mapid: Map.mapId }).addTo(map);

            return map;
        };

        Map.addMarkers = function (map, locations) {
            var _this = this;
            locations.forEach(function (loc) {
                return _this.addMarker(map, loc);
            });
        };

        Map.addMarker = function (map, location) {
            var latLng = new L.LatLng(location.latitude, location.longitude);

            new L.Marker(latLng).addTo(map);
        };
        Map.mapTileURLTemplate = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        Map.mapId = "coffeetable.hinlda0l";

        Map.defaultCenter = new L.LatLng(51.505, -0.09);
        Map.defaultZoom = 13;

        Map.locationDataPath = "preprocessor-output/processed-locations/locations.json";
        return Map;
    })();
    CommutesAndRent.Map = Map;
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var ChartModel = (function () {
        function ChartModel(successContinuation) {
            var _this = this;
            $.when(this.loadRentData("two-bedroom-rents.json"), this.loadTimesData()).then(function () {
                return successContinuation(_this);
            });
        }
        ChartModel.prototype.getDepartureData = function (time, stationName) {
            var filepath = ChartModel.departureTimesFolder + time + "/" + stationName + ".json";

            return $.getJSON(filepath);
        };

        ChartModel.prototype.loadRentData = function (filename) {
            var _this = this;
            var filepath = ChartModel.rentStatsFolder + filename;

            return $.getJSON(filepath, function (data) {
                _this.rents = data;
                return null;
            });
        };

        ChartModel.prototype.loadTimesData = function () {
            var _this = this;
            var filepath = ChartModel.departureTimesFolder + "times.json";

            return $.getJSON(filepath, function (data) {
                _this.arrivalTimes = data;
                return null;
            });
        };
        ChartModel.rentStatsFolder = "preprocessor-output/processed-rents/";
        ChartModel.departureTimesFolder = "preprocessor-output/processed-departure-times/";
        return ChartModel;
    })();
    CommutesAndRent.ChartModel = ChartModel;
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var ChartController = (function () {
        function ChartController() {
            new CommutesAndRent.ChartModel(this.initializeController);
        }
        ChartController.prototype.initializeController = function (model) {
            var _this = this;
            this.model = model;
            this.view = new CommutesAndRent.ChartView(model.rents);

            model.getDepartureData(ChartController.defaultArrivalTime, ChartController.defaultDestination).then(function (data) {
                return _this.view.setDepartureData(data);
            });
        };
        ChartController.defaultArrivalTime = 480;
        ChartController.defaultDestination = "Barbican";
        return ChartController;
    })();
    CommutesAndRent.ChartController = ChartController;
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var ChartView = (function () {
        function ChartView(rentStats) {
            this.rentStats = rentStats;

            this.chartHeight = $("#chart").height();
            this.chartWidth = $("#chart").width();
        }
        ChartView.prototype.setDepartureData = function (data) {
            this.departures = data;
            this.updateGraphic();
        };

        ChartView.prototype.updateGraphic = function () {
            var xScale = this.createXScale();
            var yScale = this.createYScale();

            d3.select("#chart").selectAll("rect").data(this.rentStats).enter().append("rect").attr(this.rentRectAttrs(xScale, yScale));
        };

        ChartView.prototype.createXScale = function () {
            var result = d3.scale.linear().domain([d3.min(this.rentStats, function (d) {
                    return d.lowerQuartile;
                }), d3.max(this.rentStats, function (d) {
                    return d.upperQuartile;
                })]).range([0, this.chartWidth]).nice();

            return result;
        };

        ChartView.prototype.createYScale = function () {
            var result = d3.scale.linear().domain([0, this.departures.arrivalTime - d3.min(this.departures.times, function (d) {
                    return d.time;
                })]).range([0, this.chartHeight]).nice();

            return result;
        };

        ChartView.prototype.rentRectAttrs = function (xScale, yScale) {
            var _this = this;
            var departureTimeLookup = {};
            this.departures.times.forEach(function (d) {
                return departureTimeLookup[d.station] = d.time;
            });

            var result = {
                x: function (d, i) {
                    return xScale(d.lowerQuartile);
                },
                y: function (d, i) {
                    return yScale(_this.departures.arrivalTime - departureTimeLookup[d.name]);
                },
                height: function () {
                    return yScale(1) - yScale(0) - ChartView.barSpacing;
                },
                width: function (d) {
                    return xScale(d.upperQuartile) - xScale(d.lowerQuartile);
                },
                opacity: 0.2
            };

            return result;
        };
        ChartView.barSpacing = 1;
        return ChartView;
    })();
    CommutesAndRent.ChartView = ChartView;
})(CommutesAndRent || (CommutesAndRent = {}));
//# sourceMappingURL=commutes-and-rent.js.map
