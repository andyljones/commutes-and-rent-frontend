var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
window.onload = function () {
    var map = new CommutesAndRent.Map();
    var controller = new CommutesAndRent.ChartController();

    var sliders = new CommutesAndRent.Sliders();
    sliders.updateTimeSubscriber = function (time) {
        return controller.updateArrivalTime(time);
    };
    sliders.updateBedroomSubscriber = function (count) {
        return controller.updateBedroomCount(count);
    };

    map.clickListener = function (name) {
        return controller.updateDestination(name);
    };
    map.mouseoverListener = function (name) {
        return controller.highlight(name);
    };

    controller.mouseoverListener = function (name) {
        return map.highlightMarker(name);
    };
};

var CommutesAndRent;
(function (CommutesAndRent) {
    var Sliders = (function () {
        //TODO: Defaults are currently in the controller.
        function Sliders() {
            this.updateTimeSubscriber = function () {
            };
            this.updateBedroomSubscriber = function () {
            };
            this.makeTimeSlider();
            this.makeBedroomCountSlider();
        }
        Sliders.prototype.makeTimeSlider = function () {
            var _this = this;
            var slider = d3slider().axis(true).min(SliderConstants.minTime).max(SliderConstants.maxTime).step(SliderConstants.stepTime).on("slide", function (event, value) {
                return _this.updateTimeSubscriber(SliderConstants.hoursToMinutes(value));
            });

            d3.select("#timeslider").call(slider);
        };

        Sliders.prototype.makeBedroomCountSlider = function () {
            var _this = this;
            var slider = d3slider().axis(true).min(SliderConstants.minBedroom).max(SliderConstants.maxBedroom).step(SliderConstants.stepBedroom).on("slide", function (event, value) {
                return _this.updateBedroomSubscriber(value);
            });

            d3.select("#bedroomslider").call(slider);
        };
        Sliders.departureTimesFolder = "preprocessor-output/processed-departure-times/";
        return Sliders;
    })();
    CommutesAndRent.Sliders = Sliders;

    var SliderConstants = (function () {
        function SliderConstants() {
        }
        SliderConstants.minTime = 7;
        SliderConstants.maxTime = 24;
        SliderConstants.stepTime = 1;
        SliderConstants.hoursToMinutes = function (n) {
            return 60 * (n - 1);
        };

        SliderConstants.minBedroom = 1;
        SliderConstants.maxBedroom = 4;
        SliderConstants.stepBedroom = 1;
        return SliderConstants;
    })();
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var Map = (function () {
        function Map() {
            var _this = this;
            this.clickListener = function () {
            };
            this.mouseoverListener = function () {
            };
            this.markerLookup = d3.map();
            this.currentlyHighlightedMarker = null;
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

                var marker = new StationMarker(locations[i].name, latLng, { icon: Map.normalMarker }).addTo(this.mapObject).on("click", function (e) {
                    return _this.clickListener(e.target.name);
                }).on("mouseover", function (e) {
                    return _this.notifyAndHighlight(e.target.name);
                });

                this.markerLookup.set(locations[i].name, marker);
            }
        };

        Map.prototype.notifyAndHighlight = function (name) {
            this.mouseoverListener(name);
            this.highlightMarker(name);
        };

        Map.prototype.highlightMarker = function (name) {
            if (this.currentlyHighlightedMarker !== null) {
                this.currentlyHighlightedMarker.setIcon(Map.normalMarker);
            }

            var marker = this.markerLookup.get(name);
            marker.setIcon(Map.highlightMarker);

            this.currentlyHighlightedMarker = marker;
        };
        Map.mapTileURLTemplate = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        Map.mapId = "coffeetable.hinlda0l";

        Map.defaultCenter = new L.LatLng(51.505, -0.09);
        Map.defaultZoom = 13;

        Map.normalMarker = L.AwesomeMarkers.icon({ markerColor: 'blue' });
        Map.highlightMarker = L.AwesomeMarkers.icon({ markerColor: 'orange' });

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
        ChartModel.prototype.loadCommuteData = function (time, stationName) {
            var _this = this;
            var filepath = ChartModel.departureTimesFolder + time + "/" + stationName + ".json";

            return Q($.getJSON(filepath)).then(function (data) {
                _this.commutes = data;
                _this.updateSubscriber();
                return null;
            });
        };

        ChartModel.prototype.loadRentData = function (numberOfBedrooms) {
            var _this = this;
            var filepath = ChartModel.rentStatsFolder + numberOfBedrooms + "-bedroom-rents.json";

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
            this.mouseoverListener = function () {
            };
            this.model = new CommutesAndRent.ChartModel();
            Q.all([
                this.model.loadRentData(ChartController.defaultNumberOfBedrooms),
                this.model.loadCommuteData(ChartController.defaultArrivalTime, ChartController.defaultDestination)
            ]).then(function () {
                return _this.initialize();
            });
        }
        ChartController.prototype.initialize = function () {
            var _this = this;
            this.view = new CommutesAndRent.ChartView(this.model);
            d3.selectAll(".rent.g").on("mouseover", function (d) {
                _this.notifyAndHighlight(d.name);
            });
        };

        ChartController.prototype.updateBedroomCount = function (bedroomCount) {
            this.model.loadRentData(bedroomCount);
        };

        ChartController.prototype.updateArrivalTime = function (arrivalTime) {
            this.model.loadCommuteData(arrivalTime, this.model.commutes.destination);
        };

        ChartController.prototype.updateDestination = function (stationName) {
            this.model.loadCommuteData(this.model.commutes.arrivalTime, stationName);
        };

        ChartController.prototype.notifyAndHighlight = function (name) {
            this.mouseoverListener(name);
            this.highlight(name);
        };

        ChartController.prototype.highlight = function (name) {
            this.view.highlightStation(name);
        };
        ChartController.defaultArrivalTime = 480;
        ChartController.defaultDestination = "Barbican";
        ChartController.defaultNumberOfBedrooms = 1;
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
            this.graphics = new CommutesAndRent.Graphics(dataset);

            var selection = this.svg.selectAll(".rent.g").data(dataset).enter().append("g").attr(this.graphics.normalPositionAttrs()).attr(this.graphics.colorAttrs(this.currentlyHighlighted));

            selection.append("rect").attr(this.graphics.barAttrs()).on('click', function (d) {
                return _this.expandTime(d.time);
            });

            selection.append("text").attr(this.graphics.normalLabelAttrs()).text(this.graphics.normalLabelText());
        };

        ChartView.prototype.update = function () {
            var _this = this;
            var dataset = ChartView.generateDataset(this.model.rents, this.model.commutes.times);
            this.graphics = new CommutesAndRent.Graphics(dataset);

            var selection = d3.selectAll(".rent.g").data(dataset, function (rentTime) {
                return rentTime.name;
            });

            selection.transition().attr(this.graphics.normalPositionAttrs()).attr(this.graphics.colorAttrs(this.currentlyHighlighted));

            selection.select(".rent.rect").attr(this.graphics.barAttrs()).on('click', function (d) {
                return _this.expandTime(d.time);
            });

            selection.select(".rent.text").transition().attr(this.graphics.normalLabelAttrs()).text(this.graphics.normalLabelText());

            this.currentlyExpanded = null;
        };

        ChartView.prototype.expandTime = function (time) {
            var selection = this.svg.selectAll(".rent.g");

            if (time === this.currentlyExpanded) {
                selection.transition().attr(this.graphics.normalPositionAttrs());
                selection.select(".rent.text").text(this.graphics.normalLabelText());
                this.currentlyExpanded = null;
            } else {
                selection.transition().attr(this.graphics.expandedPositionAttrs(time));
                selection.select(".rent.text").text(this.graphics.expandedLabelText(time));
                this.currentlyExpanded = time;
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

        ChartView.prototype.highlightStation = function (name) {
            this.currentlyHighlighted = name;

            var selection = d3.selectAll(".rent.g").attr(this.graphics.colorAttrs(this.currentlyHighlighted));

            // Bring selected node to the front:
            selection.sort(function (a, b) {
                return a.name === name ? 1 : 0;
            });
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
    var ChartConstants = (function () {
        function ChartConstants() {
        }
        ChartConstants.pixelsPerMinute = 15;
        ChartConstants.barSpacing = 2;

        ChartConstants.margins = { top: 50, right: 100, bottom: 50, left: 50 };

        ChartConstants.xAxisOffset = 40;
        ChartConstants.yAxisOffset = 40;
        return ChartConstants;
    })();
    CommutesAndRent.ChartConstants = ChartConstants;

    var Graphics = (function () {
        function Graphics(dataset) {
            this.sizes = d3.map();
            this.indices = d3.map();
            this.chartWidth = $("#chart").width();

            this.xScale = ScaleBuilders.makeXScale(dataset, this.chartWidth);
            this.yScale = ScaleBuilders.makeYScale(dataset);

            AxisBuilders.makeXAxis(this.xScale);
            AxisBuilders.makeYAxis(this.yScale);

            this.calculateOffsets(dataset);

            Graphics.setChartHeight(dataset);
        }
        Graphics.setChartHeight = function (dataset) {
            var times = dataset.map(function (departure) {
                return departure.time;
            });
            var range = d3.max(times) - d3.min(times);

            $("#chart").height(ChartConstants.pixelsPerMinute * range);
        };

        Graphics.prototype.calculateOffsets = function (dataset) {
            var sorted = dataset.sort(function (a, b) {
                return a.median - b.median;
            });

            for (var i = 0; i < dataset.length; i++) {
                var item = sorted[i];

                var count = this.sizes[item.time];

                if (typeof count === "number") {
                    this.indices[item.name] = count;
                    this.sizes[item.time] = count + 1;
                } else {
                    this.indices[item.name] = 0;
                    this.sizes[item.time] = 1;
                }
            }
        };

        Graphics.prototype.colorAttrs = function (highlighted) {
            return {
                fill: function (d) {
                    return d.name === highlighted ? "orange" : "blue";
                },
                opacity: function (d) {
                    return d.name === highlighted ? 1 : 0.2;
                }
            };
        };

        Graphics.prototype.barAttrs = function () {
            var _this = this;
            return {
                "class": "rent rect",
                x: function (d) {
                    return _this.xScale(d.lowerQuartile);
                },
                height: function () {
                    return ChartConstants.pixelsPerMinute - ChartConstants.barSpacing;
                },
                width: function (d) {
                    return _this.xScale(d.upperQuartile) - _this.xScale(d.lowerQuartile);
                }
            };
        };

        Graphics.prototype.normalPositionAttrs = function () {
            var _this = this;
            return {
                transform: function (d) {
                    return "translate(0," + _this.yScale(d.time) + ")";
                },
                "class": "rent g"
            };
        };

        Graphics.prototype.expandedPositionAttrs = function (expandedTime) {
            var _this = this;
            return {
                transform: function (d) {
                    return "translate(0," + _this.yScale(_this.offset(d, expandedTime)) + ")";
                }
            };
        };

        Graphics.prototype.normalLabelAttrs = function () {
            var _this = this;
            return {
                "class": "rent text",
                x: function () {
                    return _this.chartWidth - ChartConstants.margins.right;
                },
                y: function () {
                    return ChartConstants.pixelsPerMinute;
                }
            };
        };

        Graphics.prototype.expandedLabelText = function (expandedTime) {
            var _this = this;
            return function (d) {
                if (d.time === expandedTime || (_this.indices[d.name] === 0 && _this.sizes[d.time] === 1)) {
                    return d.name;
                } else if (_this.indices[d.name] === 0 && _this.sizes[d.time] > 1) {
                    return "+";
                } else {
                    return "";
                }
            };
        };

        Graphics.prototype.normalLabelText = function () {
            var _this = this;
            return function (d) {
                if (_this.indices[d.name] === 0 && _this.sizes[d.time] === 1) {
                    return d.name;
                } else if (_this.indices[d.name] === 0 && _this.sizes[d.time] > 1) {
                    return "+";
                } else {
                    return "";
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
        ScaleBuilders.makeXScale = function (dataset, chartWidth) {
            var lowestRent = d3.min(dataset, function (stat) {
                return stat.lowerQuartile;
            });
            var highestRent = d3.max(dataset, function (stat) {
                return stat.upperQuartile;
            });

            return d3.scale.linear().domain([lowestRent, highestRent]).range([ChartConstants.margins.left, chartWidth - ChartConstants.margins.right]);
        };

        ScaleBuilders.makeYScale = function (dataset) {
            var times = dataset.map(function (departure) {
                return departure.time;
            });
            var range = d3.max(times) - d3.min(times);

            return d3.scale.linear().domain([d3.max(times), d3.min(times)]).range([ChartConstants.margins.top, ChartConstants.pixelsPerMinute * range - ChartConstants.margins.bottom]);
        };
        return ScaleBuilders;
    })();

    var AxisBuilders = (function () {
        function AxisBuilders() {
        }
        AxisBuilders.makeXAxis = function (xScale) {
            var axis = d3.svg.axis().scale(xScale).orient("top");

            d3.select(".x.axis").attr("transform", "translate(0," + ChartConstants.xAxisOffset + ")").transition().call(axis);
        };

        AxisBuilders.makeYAxis = function (yScale) {
            var axis = d3.svg.axis().scale(yScale).orient("left");

            d3.select(".y.axis").attr("transform", "translate(" + ChartConstants.yAxisOffset + ",0)").transition().call(axis);
        };
        return AxisBuilders;
    })();
})(CommutesAndRent || (CommutesAndRent = {}));
//# sourceMappingURL=commutes-and-rent.js.map
