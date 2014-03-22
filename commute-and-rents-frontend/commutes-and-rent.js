var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
window.onload = function () {
    var map = new CommutesAndRent.Map();
    var controller = new CommutesAndRent.ChartController();

    map.markerSubscriber = function (name) {
        return controller.updateDestination(name);
    };
};

var CommutesAndRent;
(function (CommutesAndRent) {
    var Map = (function () {
        function Map() {
            var _this = this;
            this.mapObject = Map.buildMap();

            Q($.getJSON(Map.locationDataPath)).then(function (data) {
                return _this.addMarkers(data);
            });
        }
        Map.buildMap = function () {
            var map = L.map("map").setView(Map.defaultCenter, Map.defaultZoom);

            new L.TileLayer(Map.mapTileURLTemplate, { mapid: Map.mapId }).addTo(map);

            return map;
        };

        Map.prototype.addMarkers = function (locations) {
            var _this = this;
            for (var i = 0; i < locations.length; i++) {
                var latLng = new L.LatLng(locations[i].latitude, locations[i].longitude);

                new StationMarker(locations[i].name, latLng).addTo(this.mapObject).on('click', function (e) {
                    return _this.markerSubscriber(e.target.name);
                });
            }
        };
        Map.mapTileURLTemplate = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        Map.mapId = "coffeetable.hinlda0l";

        Map.defaultCenter = new L.LatLng(51.505, -0.09);
        Map.defaultZoom = 13;

        Map.locationDataPath = "preprocessor-output/processed-locations/locations.json";
        return Map;
    })();
    CommutesAndRent.Map = Map;

    var StationMarker = (function (_super) {
        __extends(StationMarker, _super);
        function StationMarker(name, latLng, options) {
            _super.call(this, latLng, options);

            this.name = name;
        }
        return StationMarker;
    })(L.Marker);
    CommutesAndRent.StationMarker = StationMarker;
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var ChartModel = (function () {
        function ChartModel() {
        }
        ChartModel.prototype.inititalize = function () {
            return Q.all([this.loadTimesData()]);
        };

        ChartModel.prototype.loadDepartureData = function (time, stationName) {
            var _this = this;
            var filepath = ChartModel.departureTimesFolder + time + "/" + stationName + ".json";

            return Q($.getJSON(filepath)).then(function (data) {
                _this.departureTimes = data;
                return null;
            });
        };

        ChartModel.prototype.loadRentData = function (filename) {
            var _this = this;
            var filepath = ChartModel.rentStatsFolder + filename;

            return Q($.getJSON(filepath)).then(function (data) {
                _this.rents = data;
                return null;
            });
        };

        ChartModel.prototype.loadTimesData = function () {
            var _this = this;
            var filepath = ChartModel.departureTimesFolder + "times.json";

            return Q($.getJSON(filepath)).then(function (data) {
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
            var _this = this;
            this.model = new CommutesAndRent.ChartModel();
            this.model.inititalize().then(function () {
                return Q.all([
                    _this.model.loadRentData(ChartController.defaultRentFile),
                    _this.model.loadDepartureData(ChartController.defaultArrivalTime, ChartController.defaultDestination)
                ]);
            }).then(function () {
                return _this.initializeController();
            });
        }
        ChartController.prototype.initializeController = function () {
            this.view = new CommutesAndRent.ChartView(this.model.rents);

            this.currentArrivalTime = ChartController.defaultArrivalTime;
            this.currentDestination = ChartController.defaultDestination;

            this.updateView();
        };

        ChartController.prototype.updateDestination = function (stationName) {
            this.currentDestination = stationName;
            this.updateView();
        };

        ChartController.prototype.updateView = function () {
            var _this = this;
            this.model.loadDepartureData(this.currentArrivalTime, this.currentDestination).then(function () {
                return _this.view.setDepartureData(_this.model.departureTimes);
            });
        };
        ChartController.defaultArrivalTime = 480;
        ChartController.defaultDestination = "Barbican";
        ChartController.defaultRentFile = "two-bedroom-rents.json";
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

            this.rects = ChartView.createGraphic(rentStats);
        }
        ChartView.createGraphic = function (rentStats) {
            return d3.select("#chart").selectAll("*").data(rentStats).enter().append("rect");
        };

        ChartView.prototype.setDepartureData = function (data) {
            this.departures = data;
            this.updateGraphic();
        };

        ChartView.prototype.updateGraphic = function () {
            var xScale = this.createXScale();
            var yScale = this.createYScale();

            this.rects.data(this.rentStats).attr(this.rentRectAttrs(xScale, yScale));
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
