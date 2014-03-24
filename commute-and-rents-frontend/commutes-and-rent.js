var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
window.onload = function () {
    var controller = new CommutesAndRent.Controller();
};

var CommutesAndRent;
(function (CommutesAndRent) {
    var SlidersController = (function () {
        function SlidersController(model) {
            this.model = model;

            this.makeTimeSlider();
            this.makeBedroomCountSlider();
        }
        SlidersController.prototype.makeTimeSlider = function () {
            var _this = this;
            var slider = d3slider().axis(true).min(SliderConstants.minTime).max(SliderConstants.maxTime).step(SliderConstants.stepTime).value(SliderConstants.minutesToHours(this.model.arrivalTime)).on("slide", function (event, value) {
                return _this.model.arrivalTime = SliderConstants.hoursToMinutes(value);
            });

            d3.select("#timeslider").call(slider);
        };

        SlidersController.prototype.makeBedroomCountSlider = function () {
            var _this = this;
            var slider = d3slider().axis(true).min(SliderConstants.minBedroom).max(SliderConstants.maxBedroom).step(SliderConstants.stepBedroom).value(this.model.bedroomCount).on("slide", function (event, value) {
                return _this.model.bedroomCount = value;
            });

            d3.select("#bedroomslider").call(slider);
        };
        return SlidersController;
    })();
    CommutesAndRent.SlidersController = SlidersController;

    var SliderConstants = (function () {
        function SliderConstants() {
        }
        SliderConstants.minTime = 7;
        SliderConstants.maxTime = 24;
        SliderConstants.stepTime = 1;
        SliderConstants.hoursToMinutes = function (n) {
            return 60 * (n - 1);
        };
        SliderConstants.minutesToHours = function (n) {
            return n / 60 + 1;
        };

        SliderConstants.minBedroom = 1;
        SliderConstants.maxBedroom = 4;
        SliderConstants.stepBedroom = 1;
        return SliderConstants;
    })();
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var MapView = (function () {
        function MapView(model) {
            var _this = this;
            this.markerLookup = d3.map();
            this.currentHighlightedMarkers = [];
            this.currentNullMarkers = [];
            this.currentDestinationMarker = null;
            this.mapObject = MapView.makeMapObject();

            this.model = model;

            Q($.getJSON(MapConstants.locationDataPath)).then(function (data) {
                _this.addMarkers(data);
                _this.highlightDestination();
                _this.model.highlightListeners.push(function () {
                    return _this.highlightMarkers();
                });
                _this.model.destinationListeners.push(function () {
                    return _this.highlightDestination();
                });
                _this.model.dataUpdateListeners.push(function () {
                    return _this.nullMarkers();
                });
                _this.model.moveToListeners.push(function (name) {
                    return _this.moveTo(name);
                });
            });
        }
        MapView.makeMapObject = function () {
            var map = L.map("map").setView(MapConstants.defaultCenter, MapConstants.defaultZoom);

            new L.TileLayer(MapConstants.mapTileURLTemplate, { mapid: MapConstants.mapId }).addTo(map);

            return map;
        };

        MapView.prototype.addMarkers = function (locations) {
            var _this = this;
            for (var i = 0; i < locations.length; i++) {
                var latLng = new L.LatLng(locations[i].latitude, locations[i].longitude);

                var marker = new StationMarker(locations[i].name, latLng, { icon: MapConstants.defaultIcon }).addTo(this.mapObject).on("click", function (e) {
                    return _this.model.destination = e.target.name;
                }).on("mouseover", function (e) {
                    return _this.model.highlighted = [e.target.name];
                });

                this.markerLookup.set(locations[i].name, marker);
            }
        };

        MapView.prototype.highlightMarkers = function () {
            var _this = this;
            var names = this.model.highlighted;

            this.currentHighlightedMarkers.forEach(function (marker) {
                if (marker === _this.currentDestinationMarker) {
                    marker.setIcon(MapConstants.destinationIcon);
                } else if (_this.currentNullMarkers.some(function (n) {
                    return n === marker;
                })) {
                    marker.setIcon(MapConstants.nullIcon);
                } else {
                    marker.setIcon(MapConstants.defaultIcon);
                }
            });

            var markers = names.map(function (name) {
                return _this.markerLookup.get(name);
            });

            markers.forEach(function (marker) {
                marker.setIcon(MapConstants.highlightIcon);
            });

            this.currentHighlightedMarkers = markers;
        };

        MapView.prototype.highlightDestination = function () {
            var name = this.model.destination;

            if (this.currentDestinationMarker !== null) {
                this.currentDestinationMarker.setIcon(MapConstants.defaultIcon);
            }

            var marker = this.markerLookup.get(name);
            marker.setIcon(MapConstants.destinationIcon);

            this.currentDestinationMarker = marker;
        };

        MapView.prototype.nullMarkers = function () {
            var _this = this;
            var names = this.model.rents.filter(function (rent) {
                return rent.median === null;
            }).map(function (rent) {
                return rent.name;
            });

            this.currentNullMarkers.forEach(function (marker) {
                if (marker === _this.currentDestinationMarker) {
                    marker.setIcon(MapConstants.destinationIcon);
                } else {
                    marker.setIcon(MapConstants.defaultIcon);
                }
            });

            var markers = names.map(function (name) {
                return _this.markerLookup.get(name);
            });

            markers.forEach(function (marker) {
                marker.setIcon(MapConstants.nullIcon);
            });

            this.currentNullMarkers = markers;
        };

        MapView.prototype.moveTo = function (name) {
            var center = this.markerLookup.get(name).getLatLng();
            this.mapObject.setView(center, MapConstants.defaultZoom);
        };
        return MapView;
    })();
    CommutesAndRent.MapView = MapView;

    var StationMarker = (function (_super) {
        __extends(StationMarker, _super);
        function StationMarker(name, latLng, options) {
            _super.call(this, latLng, options);

            this.name = name;
        }
        return StationMarker;
    })(L.Marker);

    var MapConstants = (function () {
        function MapConstants() {
        }
        MapConstants.mapTileURLTemplate = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        MapConstants.mapId = "coffeetable.hinlda0l";

        MapConstants.defaultCenter = new L.LatLng(51.505, -0.09);
        MapConstants.defaultZoom = 13;

        MapConstants.defaultIcon = L.icon({ iconUrl: "default-icon.png", iconAnchor: new L.Point(16, 34), shadowUrl: "shadow-icon.png", shadowAnchor: new L.Point(23, 35) });
        MapConstants.highlightIcon = L.icon({ iconUrl: "highlighted-icon.png", iconAnchor: new L.Point(16, 34), shadowUrl: "shadow-icon.png", shadowAnchor: new L.Point(23, 35) });
        MapConstants.destinationIcon = L.icon({ iconUrl: "destination-icon.png", iconAnchor: new L.Point(16, 34), shadowUrl: "shadow-icon.png", shadowAnchor: new L.Point(23, 35) });
        MapConstants.nullIcon = L.icon({ iconUrl: "null-icon.png", iconAnchor: new L.Point(16, 34), shadowUrl: "shadow-icon.png", shadowAnchor: new L.Point(23, 35) });

        MapConstants.locationDataPath = "preprocessor-output/processed-locations/locations.json";
        return MapConstants;
    })();
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var Model = (function () {
        function Model() {
            this.moveToListeners = [];
            this.bedroomCountListeners = [];
            this.arrivalTimeListeners = [];
            this.highlightListeners = [];
            this._highlighted = [];
            this.destinationListeners = [];
            this.dataUpdateListeners = [];
        }
        Model.prototype.moveTo = function (name) {
            this.moveToListeners.forEach(function (l) {
                return l(name);
            });
        };

        Object.defineProperty(Model.prototype, "bedroomCount", {
            get: function () {
                return this._bedroomCount;
            },
            set: function (value) {
                this._bedroomCount = value;
                this.bedroomCountListeners.forEach(function (l) {
                    return l();
                });
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(Model.prototype, "arrivalTime", {
            get: function () {
                return this._arrivalTime;
            },
            set: function (value) {
                this._arrivalTime = value;
                this.arrivalTimeListeners.forEach(function (l) {
                    return l();
                });
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(Model.prototype, "highlighted", {
            get: function () {
                return this._highlighted;
            },
            set: function (value) {
                this._highlighted = value;
                this.highlightListeners.forEach(function (l) {
                    return l();
                });
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(Model.prototype, "destination", {
            get: function () {
                return this._destination;
            },
            set: function (value) {
                this._destination = value;
                this.destinationListeners.forEach(function (l) {
                    return l();
                });
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(Model.prototype, "rents", {
            get: function () {
                return this._rents;
            },
            set: function (value) {
                this._rents = value;
                this.dataUpdateListeners.forEach(function (l) {
                    return l();
                });
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(Model.prototype, "commutes", {
            get: function () {
                return this._commutes;
            },
            set: function (value) {
                this._commutes = value;
                this.dataUpdateListeners.forEach(function (l) {
                    return l();
                });
            },
            enumerable: true,
            configurable: true
        });
        return Model;
    })();
    CommutesAndRent.Model = Model;
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var Controller = (function () {
        function Controller() {
            var _this = this;
            this.initializeModel().then(function (model) {
                _this.model = model;
                _this.chart = new CommutesAndRent.ChartView(model);
                _this.map = new CommutesAndRent.MapView(model);
                _this.sliders = new CommutesAndRent.SlidersController(model);
                _this.initializeSelf(model);
            });
        }
        Controller.prototype.initializeModel = function () {
            var model = new CommutesAndRent.Model();

            model.arrivalTime = ControllerConstants.defaultArrivalTime;
            model.destination = ControllerConstants.defaultDestination;
            model.bedroomCount = ControllerConstants.defaultNumberOfBedrooms;

            return Q.all([
                this.loadRentData(model),
                this.loadCommuteData(model)
            ]).then(function () {
                return Q(model);
            });
        };

        Controller.prototype.loadCommuteData = function (model) {
            var filepath = ControllerConstants.departureTimesFolder + model.arrivalTime + "/" + model.destination + ".json";
            return Q($.getJSON(filepath)).then(function (data) {
                model.commutes = data;
                return null;
            });
        };

        Controller.prototype.loadRentData = function (model) {
            var filepath = ControllerConstants.rentStatsFolder + model.bedroomCount + "-bedroom-rents.json";
            return Q($.getJSON(filepath)).then(function (data) {
                model.rents = data;
                return null;
            });
        };

        Controller.prototype.initializeSelf = function (model) {
            var _this = this;
            model.destinationListeners.push(function () {
                return _this.loadCommuteData(model);
            });
            model.arrivalTimeListeners.push(function () {
                return _this.loadCommuteData(model);
            });
            model.bedroomCountListeners.push(function () {
                return _this.loadRentData(model);
            });
        };
        return Controller;
    })();
    CommutesAndRent.Controller = Controller;

    var ControllerConstants = (function () {
        function ControllerConstants() {
        }
        ControllerConstants.defaultArrivalTime = 480;
        ControllerConstants.defaultDestination = "Barbican";
        ControllerConstants.defaultNumberOfBedrooms = 2;

        ControllerConstants.rentStatsFolder = "preprocessor-output/processed-rents/";
        ControllerConstants.departureTimesFolder = "preprocessor-output/processed-departure-times/";
        return ControllerConstants;
    })();
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    var ChartView = (function () {
        function ChartView(model) {
            var _this = this;
            this.currentlyExpanded = null;
            this.model = model;

            this.initialize();

            model.dataUpdateListeners.push(function () {
                return _this.update();
            });
            model.highlightListeners.push(function () {
                return _this.highlightStations();
            });
            model.destinationListeners.push(function () {
                return _this.highlightDestination();
            });
        }
        ChartView.prototype.initialize = function () {
            var _this = this;
            this.data = ChartView.generateDataset(this.model.rents, this.model.commutes);

            //d3.select("#chart")
            //    .on('click', () => this.expandOrCollapseTime(null));
            var selection = d3.select("#chart").selectAll(".bargroup").data(this.data).enter().append("g");

            selection.classed("bargroup", true).on('click', function (d) {
                return _this.expandOrCollapseTime(d);
            }).on('mouseover', function (d) {
                return _this.model.highlighted = _this.getStationsToHighlight(d);
            });

            selection.append("rect").classed("background", true);
            selection.append("rect").classed("rect", true);
            selection.append("line").classed("median", true);
            selection.append("text").classed("label", true);

            this.update();
        };

        ChartView.prototype.getStationsToHighlight = function (mouseoveredData) {
            var _this = this;
            if (mouseoveredData.time === this.currentlyExpanded) {
                return [mouseoveredData.name];
            } else {
                return this.data.filter(function (e) {
                    return e.time === mouseoveredData.time && e.time !== _this.currentlyExpanded;
                }).map(function (e) {
                    return e.name;
                });
            }
        };

        ChartView.prototype.update = function () {
            this.data = ChartView.generateDataset(this.model.rents, this.model.commutes);
            this.graphics = new Graphics(this.data);

            var selection = d3.selectAll(".bargroup").data(this.data, function (rentTime) {
                return rentTime.name;
            });

            selection.select(".rect").transition().attr(this.graphics.rectAttrs());
            selection.select(".median").transition().attr(this.graphics.medianAttrs());
            selection.select(".background").transition().attr(this.graphics.backgroundAttrs());
            selection.select(".label").transition().attr(this.graphics.labelAttrs());

            selection.classed("nulldata", function (d) {
                return d.median === null;
            });

            this.expandOrCollapseTime(null);
            this.highlightStations();
            this.highlightDestination();
        };

        ChartView.prototype.expandOrCollapseTime = function (data) {
            if (data !== null && data.time === this.currentlyExpanded) {
                this.model.moveTo(data.name);
            } else if (data !== null && this.currentlyExpanded === null) {
                this.expandTime(data.time);
            } else {
                this.expandTime(null);
            }
        };

        ChartView.prototype.expandTime = function (time) {
            console.log(time);

            var selection = d3.selectAll(".bargroup");

            selection.classed("expanded", function (d) {
                return d.time === time;
            });
            selection.classed("notexpanded", function (d) {
                return (time !== null) && (d.time !== time);
            });

            selection.transition().attr(this.graphics.groupPositionAttrs(time));
            selection.select(".label").text(this.graphics.labelText(time));

            d3.select(".y.axis").classed("suppressed", time !== null);

            this.currentlyExpanded = time;
        };

        ChartView.generateDataset = function (rents, commutes) {
            var departureLookup = commutes.times.reduce(function (m, d) {
                m.set(d.station, commutes.arrivalTime - d.time);
                return m;
            }, d3.map());
            var rentTimes = rents.map(function (rent) {
                return new RentTime(rent, departureLookup.get(rent.name));
            });

            return rentTimes;
        };

        ChartView.prototype.highlightStations = function () {
            var _this = this;
            var selection = d3.selectAll(".bargroup").classed("highlighted", function (d) {
                return _this.model.highlighted.some(function (name) {
                    return name === d.name;
                });
            });

            // Bring selected node to the front:
            if (this.model.highlighted.length === 1) {
                var name = this.model.highlighted[0];
                selection.sort(function (a, b) {
                    return a.name === name ? 1 : (b.name === name ? -1 : 0);
                });
            }
        };

        ChartView.prototype.highlightDestination = function () {
            var name = this.model.destination;

            var selection = d3.selectAll(".bargroup").classed("destination", function (d) {
                return d.name === name;
            });

            // Bring selected node to the front:
            selection.sort(function (a, b) {
                return a.name === name ? 1 : (b.name === name ? -1 : 0);
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

    var Graphics = (function () {
        function Graphics(dataset) {
            this.sizes = d3.map();
            this.indices = d3.map();
            this.chartWidth = $("#chart").width();

            this.xScale = ScaleBuilders.makeXScale(dataset, this.chartWidth);
            this.yScale = ScaleBuilders.makeYScale(dataset);

            AxisBuilders.makeXAxis(this.xScale);
            AxisBuilders.makeYAxis(this.yScale);

            this.calculateYOffsets(dataset);

            Graphics.setChartHeight(dataset);
        }
        Graphics.setChartHeight = function (dataset) {
            var times = dataset.map(function (departure) {
                return departure.time;
            });
            var range = d3.max(times) - d3.min(times);

            $("#chart").height(ChartConstants.pixelsPerMinute * range);
        };

        //TODO: This is awful.
        Graphics.prototype.calculateYOffsets = function (dataset) {
            var sorted = dataset.sort(function (a, b) {
                return a.median === null ? 1 : (b.median === null ? -1 : a.median - b.median);
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

        Graphics.prototype.rectAttrs = function () {
            var _this = this;
            return {
                x: function (d) {
                    return d.median !== null ? _this.xScale(d.lowerQuartile) : ChartConstants.margins.left;
                },
                height: function () {
                    return ChartConstants.pixelsPerMinute - ChartConstants.barSpacing;
                },
                width: function (d) {
                    return d.median !== null ? _this.xScale(d.upperQuartile) - _this.xScale(d.lowerQuartile) : _this.chartWidth - (ChartConstants.margins.right + ChartConstants.margins.left);
                }
            };
        };

        Graphics.prototype.medianAttrs = function () {
            var _this = this;
            return {
                x1: function (d) {
                    return _this.xScale(d.median);
                },
                y1: 0,
                x2: function (d) {
                    return _this.xScale(d.median);
                },
                y2: ChartConstants.pixelsPerMinute - ChartConstants.barSpacing
            };
        };

        Graphics.prototype.groupPositionAttrs = function (expandedTime) {
            var _this = this;
            return {
                transform: function (d) {
                    return "translate(0," + _this.yScale(_this.offset(d, expandedTime)) + ")";
                }
            };
        };

        Graphics.prototype.offset = function (d, expandedTime) {
            if (expandedTime === null || d.time < expandedTime) {
                return d.time;
            } else if (d.time === expandedTime) {
                return d.time + this.indices[d.name];
            } else {
                return d.time + (this.sizes[expandedTime] - 1);
            }
        };

        Graphics.prototype.backgroundAttrs = function () {
            return {
                x: ChartConstants.margins.left,
                width: this.chartWidth - ChartConstants.margins.left,
                height: ChartConstants.pixelsPerMinute - ChartConstants.barSpacing
            };
        };

        Graphics.prototype.labelAttrs = function () {
            var _this = this;
            return {
                x: function () {
                    return _this.chartWidth - ChartConstants.margins.right;
                },
                y: function () {
                    return ChartConstants.pixelsPerMinute - ChartConstants.barSpacing;
                }
            };
        };

        Graphics.prototype.labelText = function (expandedTime) {
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

            return d3.scale.linear().domain([0, d3.max(times)]).range([ChartConstants.margins.top, ChartConstants.pixelsPerMinute * range - ChartConstants.margins.bottom]).nice();
        };
        return ScaleBuilders;
    })();

    var AxisBuilders = (function () {
        function AxisBuilders() {
        }
        AxisBuilders.makeXAxis = function (xScale) {
            var axis = d3.svg.axis().scale(xScale).orient("top");

            d3.select(".x.axis").attr("transform", "translate(0," + ChartConstants.xAxisOffset + ")").call(axis);
        };

        AxisBuilders.makeYAxis = function (yScale) {
            var axis = d3.svg.axis().scale(yScale).orient("left");

            d3.select(".y.axis").attr("transform", "translate(" + ChartConstants.yAxisOffset + ",0)").call(axis);
        };
        return AxisBuilders;
    })();

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
})(CommutesAndRent || (CommutesAndRent = {}));
//# sourceMappingURL=commutes-and-rent.js.map
