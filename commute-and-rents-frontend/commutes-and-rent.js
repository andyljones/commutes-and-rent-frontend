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
            this.markerSubscriber = function () {
            };
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
            this.updateSubscriber = function () {
            };
        }
        ChartModel.prototype.initialize = function () {
            return Q.all([this.loadTimesData()]);
        };

        ChartModel.prototype.loadTimesData = function () {
            var _this = this;
            var filepath = ChartModel.departureTimesFolder + "times.json";

            return Q($.getJSON(filepath)).then(function (data) {
                _this.arrivalTimes = data;
                _this.updateSubscriber();
                return null;
            });
        };

        ChartModel.prototype.loadCommuteData = function (time, stationName) {
            var _this = this;
            var filepath = ChartModel.departureTimesFolder + time + "/" + stationName + ".json";

            return Q($.getJSON(filepath)).then(function (data) {
                _this.commutes = data;
                _this.updateSubscriber();
                return null;
            });
        };

        ChartModel.prototype.loadRentData = function (filename) {
            var _this = this;
            var filepath = ChartModel.rentStatsFolder + filename;

            return Q($.getJSON(filepath)).then(function (data) {
                _this.rents = data;
                _this.updateSubscriber();
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
            this.model.initialize().then(function () {
                return Q.all([
                    _this.model.loadRentData(ChartController.defaultRentFile),
                    _this.model.loadCommuteData(ChartController.defaultArrivalTime, ChartController.defaultDestination)
                ]);
            }).then(function () {
                return _this.initialize();
            });
        }
        ChartController.prototype.initialize = function () {
            this.view = new CommutesAndRent.ChartView(this.model);
        };

        ChartController.prototype.updateDestination = function (stationName) {
            this.model.loadCommuteData(this.model.commutes.arrivalTime, stationName);
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
        function ChartView(model) {
            var _this = this;
            this.model = model;
            model.updateSubscriber = function () {
                return _this.updateChart();
            };

            this.svg = d3.select("#chart");

            this.chartWidth = $("#chart").width();

            this.updateChart();
        }
        ChartView.prototype.updateChart = function () {
            var graphics = new CommutesAndRent.Graphics(this.model.rents, this.model.commutes.times);

            var data = this.svg.selectAll("rect").data(this.generateData(), function (rentTime) {
                return rentTime.name;
            });
            data.attr(graphics.rentRectAttrs);

            data.enter().append("rect").attr(graphics.rentRectAttrs);
        };

        ChartView.prototype.generateData = function () {
            var departureLookup = this.model.commutes.times.reduce(function (m, d) {
                m.set(d.station, d.time);
                return m;
            }, d3.map());
            var rentTimes = this.model.rents.map(function (rent) {
                return new RentTime(rent, departureLookup.get(rent.name));
            });

            return rentTimes;
        };
        return ChartView;
    })();
    CommutesAndRent.ChartView = ChartView;

    var RentTime = (function () {
        function RentTime(rentStat, time) {
            this.name = rentStat.name;
            this.lowerQuartile = rentStat.lowerQuartile;
            this.median = rentStat.median;
            this.upperQuartile = rentStat.upperQuartile;

            this.time = time;
        }
        return RentTime;
    })();
    CommutesAndRent.RentTime = RentTime;
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var Graphics = (function () {
        function Graphics(rentStats, departures) {
            var _this = this;
            this.rentRectAttrs = {
                x: function (d) {
                    return _this.xScale(d.lowerQuartile);
                },
                y: function (d) {
                    return _this.yScale(d.time);
                },
                height: 10,
                width: function (d) {
                    return _this.xScale(d.upperQuartile) - _this.xScale(d.lowerQuartile);
                }
            };
            this.xScale = this.makeXScale(rentStats);
            this.yScale = this.makeYScale(departures);
        }
        Graphics.prototype.makeXScale = function (rentStats) {
            var lowestRent = d3.min(rentStats, function (stat) {
                return stat.lowerQuartile;
            });
            var highestRent = d3.max(rentStats, function (stat) {
                return stat.upperQuartile;
            });

            return d3.scale.linear().domain([lowestRent, highestRent]).range([0, $("#chart").width()]);
        };

        Graphics.prototype.makeYScale = function (departures) {
            var times = departures.map(function (departure) {
                return departure.time;
            });
            var range = d3.max(times) - d3.min(times);

            return d3.scale.linear().domain([d3.max(times), d3.min(times)]).range([0, Graphics.pixelsPerMinute * range]);
        };
        Graphics.pixelsPerMinute = 10;
        return Graphics;
    })();
    CommutesAndRent.Graphics = Graphics;
})(CommutesAndRent || (CommutesAndRent = {}));
//# sourceMappingURL=commutes-and-rent.js.map
