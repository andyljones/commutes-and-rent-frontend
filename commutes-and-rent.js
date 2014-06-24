// Originally written in TYPESCRIPT, so if you're viewing the compiled JavaScript yup it's not pretty.
// Source can be found at https://github.com/andyljones/commutes-and-rent-frontend
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

// Instantiates the controller for the app, which will then do everything else.
window.onload = function () {
    var controller = new CommutesAndRent.Controller();
};

var CommutesAndRent;
(function (CommutesAndRent) {
    /**
    * Overall controller for the CommutesAndRent app. Instantiates and links the components, and listens to the model
    * so it can load fresh data into it as necesary.
    */
    var Controller = (function () {
        /**
        * Creates a controller for the app. Instantiates the other components of the CommutesAndRent app and links them together.
        */
        function Controller() {
            // Create a Model, load data into it and then use it to instantiate the rest of the components.
            this.initializeModel().then(function (model) {
                new CommutesAndRent.ChartView(model);
                new CommutesAndRent.MapView(model);
                new CommutesAndRent.SlidersController(model);
                Controller.initializeSelf(model);
            });
        }
        // Creates a Model and returns a promise that will resolve to a fully-initialized Model.
        Controller.prototype.initializeModel = function () {
            var model = new CommutesAndRent.Model();

            model.arrivalTime = ControllerConstants.defaultArrivalTime;
            model.destination = ControllerConstants.defaultDestination;
            model.propertyFile = ControllerConstants.defaultPropertyFile;

            return Q.all([
                Controller.loadRentData(model),
                Controller.loadCommuteData(model),
                Controller.loadShortNameData(model)
            ]).then(function () {
                return Q(model);
            });
        };

        // Loads the commute JSON file determined by the model's arrivalTime and destination fields.
        // Returns a promise that the data has been loaded into the model.
        Controller.loadCommuteData = function (model) {
            var filepath = ControllerConstants.departureTimesFolder + model.arrivalTime + "/" + model.destination + ".json";
            return Q($.getJSON(filepath)).then(function (data) {
                model.commutes = data;
                return null;
            });
        };

        // Loads the rent JSON file determined by the model's propertyFile field.
        // Returns a promise that data has been loaded into the model.
        Controller.loadRentData = function (model) {
            var filepath = ControllerConstants.rentStatsFolder + model.propertyFile;
            return Q($.getJSON(filepath)).then(function (data) {
                model.rents = data;
                return null;
            });
        };

        // Loads the short name JSON file and parses it into a D3 hashmap.
        // Returns a promise that short name data has been loaded into the model.
        Controller.loadShortNameData = function (model) {
            var filepath = ControllerConstants.shortnameFile;
            return Q($.getJSON(filepath)).then(function (data) {
                model.shortNames = Controller.parseShortNames(data);
                return null;
            });
        };

        // Parses the short-name JSON data into a D3 hashmap.
        Controller.parseShortNames = function (data) {
            var result = d3.map();

            data.forEach(function (d) {
                return result.set(d.name, d.shortname);
            });

            return result;
        };

        // Attach the Controller's data-loading methods to the Model to update it's commute/rent data
        // when the destination/arrival time/property type changes.
        Controller.initializeSelf = function (model) {
            model.destinationListeners.push(function () {
                return Controller.loadCommuteData(model);
            });
            model.arrivalTimeListeners.push(function () {
                return Controller.loadCommuteData(model);
            });
            model.propertyFileListeners.push(function () {
                return Controller.loadRentData(model);
            });
        };
        return Controller;
    })();
    CommutesAndRent.Controller = Controller;

    

    /**
    * Constants used by the Controller class.
    */
    var ControllerConstants = (function () {
        function ControllerConstants() {
        }
        ControllerConstants.defaultArrivalTime = 480;
        ControllerConstants.defaultDestination = "Barbican";
        ControllerConstants.defaultPropertyFile = "2-bedroom-rents.json";

        ControllerConstants.rentStatsFolder = "preprocessor-output/processed-rents/";
        ControllerConstants.departureTimesFolder = "preprocessor-output/processed-departure-times/";

        ControllerConstants.shortnameFile = "short-names.json";
        return ControllerConstants;
    })();
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    /**
    * Manages the slider controls for property type and arrival time.
    */
    var SlidersController = (function () {
        /**
        * Creates the slider controls and registers events with them that will update the model.
        */
        function SlidersController(model) {
            SlidersController.makeTimeSlider(model);
            SlidersController.makePropertyTypeSlider(model);
        }
        // Creates the arrival time slider control and registers an event with it that'll update Model.arrivalTime.
        SlidersController.makeTimeSlider = function (model) {
            // Create a scale and axis for the slider with ticks formatted as am/pm times.
            var scale = d3.scale.ordinal().domain(d3.range(SliderConstants.minTime, SliderConstants.maxTime, SliderConstants.stepTime)).rangePoints([0, $("#timeslider").width()]);

            var axis = d3.svg.axis().scale(scale).tickValues(d3.range(SliderConstants.minTime + 2, SliderConstants.maxTime + 1, SliderConstants.tickInterval * SliderConstants.stepTime)).tickFormat(function (t) {
                return SlidersController.formatHour(t);
            });

            // Create a slider object using the d3.slider library and register an event that'll update Model.ArrivalTime.
            var slider = d3.slider().min(SliderConstants.minTime).max(SliderConstants.maxTime).step(SliderConstants.stepTime).value(SliderConstants.minutesToHours(model.arrivalTime)).axis(axis).on("slide", function (event, value) {
                return model.arrivalTime = SliderConstants.hoursToMinutes(value);
            });

            // Add the slider to the DOM.
            d3.select("#timeslider").call(slider);
        };

        // Take an hour value and format it as am/pm.
        SlidersController.formatHour = function (t) {
            //TODO: This is ugly as sin. Come up with a better way, possibly using (%) a lot.
            if (t <= 11) {
                return t + "am";
            } else if (t == 12) {
                return "12pm";
            } else if (12 < t && t < 24) {
                return (t % 12) + "pm";
            } else if (t === 24) {
                return "12am";
            }
        };

        // Creates the property type slider and registers an event with it that'll update Model.propertyFile.
        SlidersController.makePropertyTypeSlider = function (model) {
            // Create a scale and axis for the slider with ticks formatted with SliderConstants.propertyTypes.
            var scale = d3.scale.ordinal().domain(d3.range(0, SliderConstants.propertyTypes.length - 1, 1)).rangePoints([0, $("#bedroomslider").width()]);

            var axis = d3.svg.axis().scale(scale).tickValues(d3.range(0, SliderConstants.propertyTypes.length, 1)).tickFormat(function (d) {
                return SliderConstants.propertyTypes[d];
            });

            // Create a slider object using the d3.slider library and registed an event to update Model.propertyFile.
            var slider = d3.slider().min(0).max(SliderConstants.propertyTypes.length - 1).step(1).value(SliderConstants.rentFilenames.indexOf(model.propertyFile)).axis(axis).on("slide", function (event, value) {
                return model.propertyFile = SliderConstants.rentFilenames[value];
            });

            // Add the slider to the DOM.
            d3.select("#bedroomslider").call(slider);
        };
        return SlidersController;
    })();
    CommutesAndRent.SlidersController = SlidersController;

    /**
    * Constants used in the SlidersControl class.
    */
    var SliderConstants = (function () {
        function SliderConstants() {
        }
        SliderConstants.minTime = 7;
        SliderConstants.maxTime = 24;
        SliderConstants.stepTime = 1;
        SliderConstants.tickInterval = 3;

        SliderConstants.hoursToMinutes = function (n) {
            return 60 * (n - 1);
        };
        SliderConstants.minutesToHours = function (n) {
            return n / 60 + 1;
        };

        SliderConstants.propertyTypes = ["Room", "Studio", "1 bed", "2 bed", "3 bed", "4+ bed"];
        SliderConstants.rentFilenames = ["room-rents.json", "studio-rents.json", "1-bedroom-rents.json", "2-bedroom-rents.json", "3-bedroom-rents.json", "4-bedroom-rents.json"];
        return SliderConstants;
    })();
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    /**
    * Manages the map of stations.
    */
    var MapView = (function () {
        /**
        * Instantiates a map of stations, and registers functions with the model that will update various fields
        * when markers are moused over, become a destination, are moved to or when they refer to null data points.
        */
        function MapView(model) {
            var _this = this;
            this.currentHighlightedMarkers = [];
            this.currentNullMarkers = [];
            this.currentDestinationMarker = null;
            this.model = model;
            this.mapObject = MapView.makeMapObject();

            // Load location data and use it to place markers on the map and build a station name -> marker hashmap.
            // Then register events with the model for highlighted markers, for changes of destination, for and
            // requests that the map center on a station.
            Q($.getJSON(MapConstants.locationDataPath)).then(function (data) {
                _this.markerLookup = _this.addMarkers(data);
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
        // Create the map object using the Leaflet library.
        MapView.makeMapObject = function () {
            var map = L.map("map").setView(MapConstants.defaultCenter, MapConstants.defaultZoom);

            // Load the tile layer for the map.
            new L.TileLayer(MapConstants.mapTileURLTemplate, { mapid: MapConstants.mapId }).addTo(map);

            return map;
        };

        // Place map markers at the listed locations and register click & mouseover events on them. Also constructs and
        // returns a hashmap that takes station names to their corresponding markers.
        MapView.prototype.addMarkers = function (locations) {
            var _this = this;
            var result = d3.map();

            for (var i = 0; i < locations.length; i++) {
                var name = locations[i].name;
                var latLng = new L.LatLng(locations[i].latitude, locations[i].longitude);

                // Create a marker at the latitude & longitude of the location,
                var marker = new StationMarker(name, latLng, { icon: MapConstants.defaultIcon, title: name }).addTo(this.mapObject).on("click", function (e) {
                    return _this.model.destination = e.target.name;
                }).on("mouseover", function (e) {
                    return _this.model.highlighted = [e.target.name];
                });

                result.set(name, marker);
            }

            return result;
        };

        // When called, updates the highlighted markers on the map to match the names in this.model.highlighted.
        MapView.prototype.highlightMarkers = function () {
            var _this = this;
            // Un-highlight every currently highlighted marker, giving them back the correct icons.
            //TODO: This is ugly as sin. Come up with a better way.
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

            // Highlight each marker whose name is listed in this.model.highlighted.
            var markers = this.model.highlighted.map(function (name) {
                return _this.markerLookup.get(name);
            });

            markers.forEach(function (marker) {
                marker.setIcon(MapConstants.highlightIcon);
            });

            this.currentHighlightedMarkers = markers;
        };

        // When called, updates the marker currently with the destination icon to match this.mode.destination.
        MapView.prototype.highlightDestination = function () {
            // Set the current destination marker back to its default icon.
            if (this.currentDestinationMarker !== null) {
                this.currentDestinationMarker.setIcon(MapConstants.defaultIcon);
            }

            // Update the marker corresponding to this.model.destination to have the destination marker icon.
            var marker = this.markerLookup.get(this.model.destination);
            marker.setIcon(MapConstants.destinationIcon);

            this.currentDestinationMarker = marker;
        };

        // When called, updates the set of markers with the null data icon to match the stations with null rent data.
        MapView.prototype.nullMarkers = function () {
            var _this = this;
            // Set every marker currently with a null icon back to their original icons.
            //TODO: This is ugly as sin. Come up with a better way.
            this.currentNullMarkers.forEach(function (marker) {
                if (marker === _this.currentDestinationMarker) {
                    marker.setIcon(MapConstants.destinationIcon);
                } else {
                    marker.setIcon(MapConstants.defaultIcon);
                }
            });

            // Update each marker whose name has missing rent data to the null data icon.
            var markers = this.model.rents.filter(function (rent) {
                return rent.median === null;
            }).map(function (rent) {
                return _this.markerLookup.get(rent.name);
            });

            markers.forEach(function (marker) {
                marker.setIcon(MapConstants.nullIcon);
            });

            this.currentNullMarkers = markers;
        };

        // Recenter the map over the named station.
        MapView.prototype.moveTo = function (name) {
            var center = this.markerLookup.get(name).getLatLng();
            this.mapObject.setView(center, MapConstants.defaultZoom);
        };
        return MapView;
    })();
    CommutesAndRent.MapView = MapView;

    

    /**
    * A subclass of Leaflet's L.Marker that adds a name field.
    */
    var StationMarker = (function (_super) {
        __extends(StationMarker, _super);
        // A proxy for L.Marker's constructor.
        function StationMarker(name, latLng, options) {
            _super.call(this, latLng, options);

            this.name = name;
        }
        return StationMarker;
    })(L.Marker);

    /**
    * Constants for the MapView class.
    */
    var MapConstants = (function () {
        function MapConstants() {
        }
        MapConstants.mapTileURLTemplate = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        MapConstants.mapId = "coffeetable.hinlda0l";

        MapConstants.locationDataPath = "preprocessor-output/processed-locations/locations.json";

        MapConstants.defaultCenter = new L.LatLng(51.505, -0.09);
        MapConstants.defaultZoom = 13;

        MapConstants.defaultIcon = L.icon({ iconUrl: "icons/default-icon.png", prototype: MapConstants.commonIconOptions });
        MapConstants.highlightIcon = L.icon({ iconUrl: "icons/highlighted-icon.png", prototype: MapConstants.commonIconOptions });
        MapConstants.destinationIcon = L.icon({ iconUrl: "icons/destination-icon.png", prototype: MapConstants.commonIconOptions });
        MapConstants.nullIcon = L.icon({ iconUrl: "icons/null-icon.png", prototype: MapConstants.commonIconOptions });

        MapConstants.commonIconOptions = { iconAnchor: new L.Point(16, 34), shadowUrl: "shadow-icon.png", shadowAnchor: new L.Point(23, 35) };
        return MapConstants;
    })();
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    /**
    * Manages the chart of rents vs commute times.
    */
    var ChartView = (function () {
        /**
        * Instantiates a chart of rents vs commute times using the data held in the model, and registers events
        * on the model that will cause the chart to update when the model's data is.
        */
        function ChartView(model) {
            var _this = this;
            this.currentlyExpanded = null;
            this.initialize(model);

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
        // Sets the this.model and this.data fields, and creates the DOM elements that'll be used to display the data.
        // Then calls this.update(), which provides the positioning for the DOM elements.
        ChartView.prototype.initialize = function (model) {
            var _this = this;
            this.model = model;
            this.data = ChartView.generateDataset(this.model.rents, this.model.commutes);

            // Create a <g> SVG element for each item in this.data.
            var selection = d3.select("#chart").selectAll(".bargroup").data(this.data).enter().append("g");

            // Give the <g> elements a class that they can later be referenced by, and attaches click & mouseover events to
            // each one.
            selection.classed("bargroup", true).on('click', function (d) {
                return _this.clickedOn(d);
            }).on('mouseover', function (d) {
                return _this.model.highlighted = _this.getStationsToHighlight(d);
            });

            // Add geometric elements to each <g> element that'll be used to display the data.
            selection.append("rect").classed("background", true);
            selection.append("rect").classed("rect", true);
            selection.append("line").classed("median", true);
            selection.append("text").classed("label", true);

            this.update();
        };

        // Generates an array of RentTimes from the provided data, which contain the rent and commute time statistics for each station.
        ChartView.generateDataset = function (rents, commutes) {
            // Build a hashmap that takes station names to the time needed to commute there.
            var commuteLookup = commutes.times.reduce(function (m, d) {
                m.set(d.station, commutes.arrivalTime - d.time);
                return m;
            }, d3.map());

            // Combine the rent data with the commute times.
            var rentTimes = rents.map(function (rent) {
                return new RentTime(rent, commuteLookup.get(rent.name));
            });

            return rentTimes;
        };

        // Get a list of the names of the stations whose elements should be highlighted.
        ChartView.prototype.getStationsToHighlight = function (mouseoveredData) {
            var _this = this;
            // If the mouseover'd element is part of the expanded selection, return the name of it alone.
            // If the mouseover'd element isn't currently expanded, return the names of every element sharing its line.
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

        // Generates new this.data and this.graphics using the current model data, then updates the chart elements to reflect that data.
        ChartView.prototype.update = function () {
            this.data = ChartView.generateDataset(this.model.rents, this.model.commutes);
            this.graphics = new Graphics(this.data, this.model.shortNames);

            // Attach the new data to the chart's bargroup elements, using the station name to match.
            var selection = d3.selectAll(".bargroup").data(this.data, function (rentTime) {
                return rentTime.name;
            });

            // Update the positional data of the chart elements.
            selection.select(".rect").transition().attr(this.graphics.rectAttrs());
            selection.select(".median").transition().attr(this.graphics.medianAttrs());
            selection.select(".background").transition().attr(this.graphics.backgroundAttrs());
            selection.select(".label").transition().attr(this.graphics.labelAttrs());

            // Highlight null data.
            this.highlightNullData();

            // Collapse the bars.
            this.clickedOn(null);

            // Update bar colouring.
            this.highlightStations();
            this.highlightDestination();
        };

        // Deals with clicks on the chart's bars.
        // If passed a datapoint that's already expanded, it moves the map to the corresponding station.
        // If passed a datapoint that isn't already expanded, it expands the corresponding time.
        // If passed null, it'll collapse any bars that are currently expanded.
        ChartView.prototype.clickedOn = function (datapoint) {
            if (datapoint !== null && datapoint.time === this.currentlyExpanded) {
                this.model.moveTo(datapoint.name);
            } else if (datapoint !== null && this.currentlyExpanded === null) {
                this.expandTime(datapoint.time);
            } else {
                this.expandTime(null);
            }
        };

        // Expands a time, splaying out the bars corresponding to that time.
        // If passed null, it'll collapse any bars that are currently expanded.
        ChartView.prototype.expandTime = function (time) {
            var selection = d3.selectAll(".bargroup");

            // Update the "expanded" and "notexpanded" element classes, which are used for visual highlighting with CSS.
            selection.classed("expanded", function (d) {
                return d.time === time;
            });
            selection.classed("notexpanded", function (d) {
                return (time !== null) && (d.time !== time);
            });

            // Update the positions of the bars.
            selection.transition().attr(this.graphics.groupPositionAttrs(time));

            // Update the bar's labels.
            selection.select(".label").text(this.graphics.labelText(time));

            // Mark the y-axis as "suppressed" if a group is being expanded.
            d3.select(".y.axis").classed("suppressed", time !== null);

            this.currentlyExpanded = time;
        };

        // Update the set of chart elements in the "highlighted" class to match this.model.highlighted.
        // If there's a single highlighted element, it'll also bring it to the front of the scene.
        ChartView.prototype.highlightStations = function () {
            var _this = this;
            var selection = d3.selectAll(".bargroup").classed("highlighted", function (d) {
                return _this.model.highlighted.some(function (name) {
                    return name === d.name;
                });
            });

            // If there's a single highlighted station, sort the elements in the selection to bring the highlighted
            // one to the front:
            if (this.model.highlighted.length === 1) {
                var name = this.model.highlighted[0];
                selection.sort(function (a, b) {
                    return a.name === name ? 1 : (b.name === name ? -1 : 0);
                });
            }
        };

        // Update the chart element in the "destination" class to match this.model.destination and bring that element
        // to the front of the scene.
        ChartView.prototype.highlightDestination = function () {
            var name = this.model.destination;

            var selection = d3.selectAll(".bargroup").classed("destination", function (d) {
                return d.name === name;
            });

            // Sort the elements in the selection to bring the destination to the front:
            selection.sort(function (a, b) {
                return a.name === name ? 1 : (b.name === name ? -1 : 0);
            });
        };

        // Update the set of chart elements in the "nulldata" class to match the datapoints with null medians.
        ChartView.prototype.highlightNullData = function () {
            var selection = d3.selectAll(".bargroup").classed("nulldata", function (d) {
                return d.median === null;
            });
        };
        return ChartView;
    })();
    CommutesAndRent.ChartView = ChartView;

    /**
    * A single chart datapoint, containing both rent data for a station and the commute time to it.
    */
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

    /**
    * Provides methods that map RentTime datapoints to SVG attributes that can be applied to chart elements.
    */
    var Graphics = (function () {
        /**
        * Constructs a set of RentTime -> graphical attribute methods using the given data and short names.
        */
        function Graphics(dataset, shortnames) {
            this.sizes = d3.map();
            this.indices = d3.map();
            // Defining the chart element's width here because Firefox gives a zero width if the height is defined by JS but the width by CSS.
            $("#chart").width($("#chart-holder").width());
            $("#chart").height(ChartConstants.pixelsPerMinute * ChartConstants.yScaleDomainMax);

            this.chartWidth = $("#chart").width();

            this.shortnames = shortnames;

            // Construct x and y scales from the data.
            this.xScale = ScaleBuilders.makeXScale(dataset, this.chartWidth);
            this.yScale = ScaleBuilders.makeYScale();

            // Construct and display the axes for the chart
            AxisBuilders.makeXAxis(this.xScale);
            AxisBuilders.makeYAxis(this.yScale);

            // Calculate the information needed to position bars when a time is expanded.
            this.calculateYOffsets(dataset);
        }
        // Calculate the number of datapoints at each Y value (stored in this.sizes), and give each datapoint an index
        // within the set of datapoints which share its Y value (stored in this.indices).
        Graphics.prototype.calculateYOffsets = function (dataset) {
            // Pull null data to the start of the array, so when it's displayed its graphical elements will be drawn
            // first (and hence be at the back).
            var sorted = dataset.sort(function (a, b) {
                return a.median === null ? 1 : (b.median === null ? -1 : a.median - b.median);
            });

            for (var i = 0; i < dataset.length; i++) {
                var item = sorted[i];
                var time = item.time;
                var count = this.sizes[time];

                // If a time already has a value in sizes, use it to set the index for item and then increment it.
                // Otherwise, set the time's value in sizes to one and the index of the item to 0.
                if (typeof count === "number") {
                    this.indices[item.name] = count;
                    this.sizes[time] = count + 1;
                } else {
                    this.indices[item.name] = 0;
                    this.sizes[time] = 1;
                }
            }
        };

        /**
        * Returns an attributes object for the rectangle that represents a datapoint.
        */
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

        /**
        * Returns an attributes object for the line that represents a datapoint's median.
        */
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

        /**
        * Returns an attributes object for the group that represents a datapoint.
        */
        Graphics.prototype.groupPositionAttrs = function (expandedTime) {
            var _this = this;
            return {
                transform: function (d) {
                    return "translate(0," + _this.yScale(_this.offset(d, expandedTime) - 0.5) + ")";
                }
            };
        };

        // Calculates the possibly-offset time for a datapoint, taking into account which times have been expanded.
        Graphics.prototype.offset = function (d, expandedTime) {
            // If no time has been expanded, or if the time expanded is greater than the datapoint in question, just return
            // the datapoint's time.
            // If the expanded time is the same as the datapoint's time, return the datapoint's time offset by it's
            // index in the set of datapoints that have the same time.
            // If the expanded time is less than the datapoint's time, return the datapoint's time plus the number of places it
            // needs to be moved down by.
            if (expandedTime === null || d.time < expandedTime) {
                return d.time;
            } else if (d.time === expandedTime) {
                return d.time + this.indices[d.name];
            } else {
                return d.time + (this.sizes[expandedTime] - 1);
            }
        };

        /**
        * Returns an attributes object for the background rectangle that represents a datapoint.
        */
        Graphics.prototype.backgroundAttrs = function () {
            return {
                x: ChartConstants.margins.left,
                width: this.chartWidth - ChartConstants.margins.left,
                height: ChartConstants.pixelsPerMinute - ChartConstants.barSpacing
            };
        };

        /**
        * Returns an attributes object for the label that represents a datapoint.
        */
        Graphics.prototype.labelAttrs = function () {
            var _this = this;
            return {
                x: function () {
                    return _this.chartWidth - ChartConstants.margins.right + ChartConstants.xLabelOffset;
                },
                y: function () {
                    return ChartConstants.pixelsPerMinute - ChartConstants.barSpacing - ChartConstants.yLabelOffset;
                }
            };
        };

        /**
        * Returns the text for a label that represents a datapoint.
        */
        Graphics.prototype.labelText = function (expandedTime) {
            var _this = this;
            return function (d) {
                if (d.time === expandedTime || (_this.indices[d.name] === 0 && _this.sizes[d.time] === 1)) {
                    return _this.shortnames.get(d.name) || d.name;
                } else if (_this.indices[d.name] === 0 && _this.sizes[d.time] > 1) {
                    return "+";
                } else {
                    return "";
                }
            };
        };
        return Graphics;
    })();

    /**
    * Static methods to construct a rent and commute time scales.
    */
    var ScaleBuilders = (function () {
        function ScaleBuilders() {
        }
        /**
        * Construct a linear scale of rents spanning from the lowest rent lower quartile to the greatest upper quartile.
        */
        ScaleBuilders.makeXScale = function (dataset, chartWidth) {
            var lowestRent = d3.min(dataset, function (stat) {
                return stat.lowerQuartile;
            });
            var highestRent = d3.max(dataset, function (stat) {
                return stat.upperQuartile;
            });

            return d3.scale.linear().domain([lowestRent, highestRent]).rangeRound([ChartConstants.margins.left, chartWidth - ChartConstants.margins.right]).nice();
        };

        /**
        * Construct a linear scale of times spanning from 0 to ChartConstants.yScaleDomainMax.
        */
        ScaleBuilders.makeYScale = function () {
            return d3.scale.linear().domain([0, ChartConstants.yScaleDomainMax]).rangeRound([ChartConstants.margins.top, ChartConstants.pixelsPerMinute * ChartConstants.yScaleDomainMax - ChartConstants.margins.bottom]).nice();
        };
        return ScaleBuilders;
    })();

    /**
    * Static methods to construct rent and commute time axes.
    */
    var AxisBuilders = (function () {
        function AxisBuilders() {
        }
        /**
        * Construct and draw the X (rent) axis.
        */
        AxisBuilders.makeXAxis = function (xScale) {
            var axis = d3.svg.axis().scale(xScale).orient("top").ticks(5);

            d3.select(".x.axis").attr("transform", "translate(0," + ChartConstants.xAxisOffset + ")").transition().call(axis);

            AxisBuilders.makeXLabel(xScale);
        };

        AxisBuilders.makeXLabel = function (xScale) {
            if ($(".x.label").length === 0) {
                var midpoint = (xScale.range()[0] + xScale.range()[1]) / 2;

                d3.select(".x.axis").append("text").classed("x label", true).attr("transform", "translate(" + midpoint + "," + ChartConstants.xAxisLabelYOffset + ")").attr("text-anchor", "middle").text("Rent Range (£/month)");
            }
        };

        /**
        * Construct and draw the Y (commute time) axis.
        */
        AxisBuilders.makeYAxis = function (yScale) {
            var axis = d3.svg.axis().scale(yScale).orient("left");

            d3.select(".y.axis").attr("transform", "translate(" + ChartConstants.yAxisOffset + ",0)").transition().call(axis);

            AxisBuilders.makeYLabel(yScale);
        };

        AxisBuilders.makeYLabel = function (yScale) {
            if ($(".y.label").length === 0) {
                var midpoint = $("#app").height() / 2;

                d3.select(".y.axis").append("text").classed("y label", true).attr("transform", "translate(" + ChartConstants.yAxisLabelXOffset + "," + midpoint + "), rotate(-90)").attr("text-anchor", "middle").text("Commute Time (mins)");
            }
        };
        return AxisBuilders;
    })();

    /**
    * Constants for the ChartView class & supporting classes.
    */
    var ChartConstants = (function () {
        function ChartConstants() {
        }
        ChartConstants.pixelsPerMinute = 15;
        ChartConstants.barSpacing = 2;

        ChartConstants.margins = { top: 50, right: 130, bottom: 50, left: 60 };

        ChartConstants.xAxisOffset = 40;
        ChartConstants.yAxisOffset = 50;

        ChartConstants.xAxisLabelYOffset = -25;
        ChartConstants.yAxisLabelXOffset = -32;

        ChartConstants.yLabelOffset = 3;
        ChartConstants.xLabelOffset = 10;

        ChartConstants.yScaleDomainMax = 120;
        return ChartConstants;
    })();
})(CommutesAndRent || (CommutesAndRent = {}));

var CommutesAndRent;
(function (CommutesAndRent) {
    /**
    * The model for the app. Holds all data that's shared between components, and allows components to register for
    * updates when its data fields change.
    */
    var Model = (function () {
        function Model() {
            // Listeners and field for recentering the map.
            this.moveToListeners = [];
            // Listeners, accessors and field for the propertyFile used.
            this.propertyFileListeners = [];
            // Listeners, accessors and field for the arrival time.
            this.arrivalTimeListeners = [];
            // Listeners, accessors and field for the names of the set of highlighted stations.
            this.highlightListeners = [];
            this._highlighted = [];
            // Listeners, accessors and field for the destination station name.
            this.destinationListeners = [];
            // Listeners, accessors and field for the rent and commute data that's loaded.
            this.dataUpdateListeners = [];
            // The name to short name hashmap.
            this.shortNames = d3.map();
        }
        Model.prototype.moveTo = function (name) {
            this.moveToListeners.forEach(function (l) {
                return l(name);
            });
        };

        Object.defineProperty(Model.prototype, "propertyFile", {
            get: function () {
                return this._propertyFile;
            },
            set: function (value) {
                this._propertyFile = value;
                this.propertyFileListeners.forEach(function (l) {
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
//# sourceMappingURL=commutes-and-rent.js.map
