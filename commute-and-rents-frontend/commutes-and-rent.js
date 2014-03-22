﻿var __extends = this.__extends || function (d, b) {
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
                return _this.update();
            };

            this.svg = d3.select("#chart");

            this.initialize();
        }
        ChartView.prototype.initialize = function () {
            var _this = this;
            var dataset = ChartView.generateDataset(this.model.rents, this.model.commutes.times);
            var graphics = new CommutesAndRent.Graphics(dataset);

            this.svg.selectAll("rect").data(dataset).enter().append("rect").attr(graphics.normalRentAttrs()).on('click', function (d) {
                return _this.expandTime(graphics, d);
            });
        };

        ChartView.prototype.update = function () {
            var _this = this;
            var dataset = ChartView.generateDataset(this.model.rents, this.model.commutes.times);
            var graphics = new CommutesAndRent.Graphics(dataset);

            this.svg.selectAll("rect").data(dataset, function (rentTime) {
                return rentTime.name;
            }).on('click', function (d) {
                return _this.expandTime(graphics, d);
            }).transition().attr(graphics.normalRentAttrs());
        };

        ChartView.prototype.expandTime = function (graphics, d) {
            var data = this.svg.selectAll("rect");

            if (d.time === this.currentlyExpanded) {
                data.transition().attr(graphics.normalRentAttrs());
                this.currentlyExpanded = null;
            } else {
                data.transition().attr(graphics.expandedRentAttrs(d.time));
                this.currentlyExpanded = d.time;
            }
        };

        ChartView.generateDataset = function (rents, departures) {
            var departureLookup = departures.reduce(function (m, d) {
                m.set(d.station, d.time);
                return m;
            }, d3.map());
            var rentTimes = rents.map(function (rent) {
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
    var Constants = (function () {
        function Constants() {
        }
        Constants.pixelsPerMinute = 15;
        Constants.barSpacing = 2;

        Constants.verticalMargin = 50;
        Constants.horizontalMargin = 50;

        Constants.xAxisOffset = 40;
        Constants.yAxisOffset = 40;
        return Constants;
    })();
    CommutesAndRent.Constants = Constants;

    var Graphics = (function () {
        function Graphics(dataset) {
            this.sizes = d3.map();
            this.indices = d3.map();
            this.xScale = ScaleBuilders.makeXScale(dataset);
            this.yScale = ScaleBuilders.makeYScale(dataset);

            AxisBuilders.makeXAxis(this.xScale);
            AxisBuilders.makeYAxis(this.yScale);

            this.calculateOffsets(dataset);
        }
        Graphics.prototype.calculateOffsets = function (dataset) {
            for (var i = 0; i < dataset.length; i++) {
                var count = this.sizes[dataset[i].time];

                if (typeof count === "number") {
                    this.indices[dataset[i].name] = count;
                    this.sizes[dataset[i].time] = count + 1;
                } else {
                    this.indices[dataset[i].name] = 0;
                    this.sizes[dataset[i].time] = 1;
                }
            }
        };

        Graphics.prototype.normalRentAttrs = function () {
            var _this = this;
            return {
                x: function (d) {
                    return _this.xScale(d.lowerQuartile);
                },
                y: function (d) {
                    return _this.yScale(d.time);
                },
                height: function () {
                    return Constants.pixelsPerMinute - Constants.barSpacing;
                },
                width: function (d) {
                    return _this.xScale(d.upperQuartile) - _this.xScale(d.lowerQuartile);
                },
                opacity: 0.2
            };
        };

        Graphics.prototype.expandedRentAttrs = function (expandedTime) {
            var _this = this;
            return {
                y: function (d) {
                    return _this.yScale(_this.offset(d, expandedTime));
                }
            };
        };

        Graphics.prototype.offset = function (d, expandedTime) {
            if (d.time < expandedTime) {
                return d.time - (this.sizes[expandedTime] - 1);
            } else if (d.time === expandedTime) {
                return d.time - this.indices[d.name];
            } else {
                return d.time;
            }
        };
        return Graphics;
    })();
    CommutesAndRent.Graphics = Graphics;

    var ScaleBuilders = (function () {
        function ScaleBuilders() {
        }
        ScaleBuilders.makeXScale = function (dataset) {
            var lowestRent = d3.min(dataset, function (stat) {
                return stat.lowerQuartile;
            });
            var highestRent = d3.max(dataset, function (stat) {
                return stat.upperQuartile;
            });

            return d3.scale.linear().domain([lowestRent, highestRent]).range([Constants.horizontalMargin, $("#chart").width() - Constants.horizontalMargin]);
        };

        ScaleBuilders.makeYScale = function (dataset) {
            var times = dataset.map(function (departure) {
                return departure.time;
            });
            var range = d3.max(times) - d3.min(times);

            return d3.scale.linear().domain([d3.max(times), d3.min(times)]).range([Constants.verticalMargin, Constants.pixelsPerMinute * range - Constants.verticalMargin]);
        };
        return ScaleBuilders;
    })();

    var AxisBuilders = (function () {
        function AxisBuilders() {
        }
        AxisBuilders.makeXAxis = function (xScale) {
            var axis = d3.svg.axis().scale(xScale).orient("top");

            d3.select(".x.axis").attr("transform", "translate(0," + Constants.xAxisOffset + ")").transition().call(axis);
        };

        AxisBuilders.makeYAxis = function (yScale) {
            var axis = d3.svg.axis().scale(yScale).orient("right");

            d3.select(".y.axis").attr("transform", "translate(" + ($("#chart").width() - Constants.yAxisOffset) + ",0)").transition().call(axis);
        };
        return AxisBuilders;
    })();
})(CommutesAndRent || (CommutesAndRent = {}));
//# sourceMappingURL=commutes-and-rent.js.map
