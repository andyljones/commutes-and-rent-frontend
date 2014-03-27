// Originally written in TYPESCRIPT, so if you're viewing the compiled JavaScript yup it's not pretty.
// Source can be found at https://github.com/andyljones/commutes-and-rent-frontend

// EXPORTS IN THIS FILE:
// - CommutesAndRent.Controller
//    - Instantiates and links other components.
//    - Loads data into the model, both at initialization and during operation.
//
// - CommutesAndRent.SlidersController
//    - Instantiates the arrival time & property type sliders.
//    - Captures input from them and updates the model.
//
// - CommutesAndRent.MapView
//    - Instantiates the map.
//    - Updates map to reflect the model.
//    - Captures input from the map and uses it to update the model.
//
// - CommutesAndRent.ChartView
//    - Instantiates the chart.
//    - Updates the chart to reflect the model.
//    - Captures input from the chart and uses it to update the model.
//
// - CommutesAndRent.Model
//    - Holds any state that's shared between components.
//    - Allows components to register for notification when its fields are modified. 


// Declare the d3.slider() function to be part of the D3 namespace. 
// Necessary because the d3.slider library doesn't have a definition file.
declare module D3 {
    export interface Base {
        slider(): any;
    }
}

// Instantiates the controller for the app, which will then do everything else. 
window.onload = () => {
    var controller: CommutesAndRent.Controller = new CommutesAndRent.Controller();
};

module CommutesAndRent {

    /**
     * Overall controller for the CommutesAndRent app. Instantiates and links the components, and listens to the model
     * so it can load fresh data into it as necesary.
     */
    export class Controller {

        /**
         * Creates a controller for the app. Instantiates the other components of the CommutesAndRent app and links them together.
         */
        constructor() {
            // Create a Model, load data into it and then use it to instantiate the rest of the components.
            this.initializeModel()
                .then(model => {
                    new ChartView(model);
                    new MapView(model);
                    new SlidersController(model);
                    Controller.initializeSelf(model);
                });
        }

        // Creates a Model and returns a promise that will resolve to a fully-initialized Model.
        private initializeModel(): Q.Promise<Model> {
            var model = new Model();

            model.arrivalTime = ControllerConstants.defaultArrivalTime;
            model.destination = ControllerConstants.defaultDestination;
            model.propertyFile = ControllerConstants.defaultPropertyFile;

            return Q.all([
                Controller.loadRentData(model),
                Controller.loadCommuteData(model),
                Controller.loadShortNameData(model)
            ]).then(() => Q(model));
        }

        // Loads the commute JSON file determined by the model's arrivalTime and destination fields.
        // Returns a promise that the data has been loaded into the model.
        private static loadCommuteData(model: Model): Q.Promise<void> {
            var filepath: string = ControllerConstants.departureTimesFolder + model.arrivalTime + "/" + model.destination + ".json";
            return Q($.getJSON(filepath)).then(data => { model.commutes = data; return null; });
        }

        // Loads the rent JSON file determined by the model's propertyFile field.
        // Returns a promise that data has been loaded into the model.
        private static loadRentData(model: Model): Q.Promise<void> {
            var filepath: string = ControllerConstants.rentStatsFolder + model.propertyFile;
            return Q($.getJSON(filepath)).then(data => { model.rents = data; return null; });
        }

        // Loads the short name JSON file and parses it into a D3 hashmap.
        // Returns a promise that short name data has been loaded into the model.
        private static loadShortNameData(model: Model): Q.Promise<void> {
            var filepath: string = ControllerConstants.shortnameFile;
            return Q($.getJSON(filepath)).then(data => { model.shortNames = Controller.parseShortNames(data); return null; });
        }

        // Parses the short-name JSON data into a D3 hashmap.
        private static parseShortNames(data: ShortName[]): D3.Map {
            var result = d3.map();

            data.forEach(d => result.set(d.name, d.shortname));

            return result;
        }

        // Attach the Controller's data-loading methods to the Model to update it's commute/rent data 
        // when the destination/arrival time/property type changes.
        private static initializeSelf(model: Model): void {
            model.destinationListeners.push(() => Controller.loadCommuteData(model));
            model.arrivalTimeListeners.push(() => Controller.loadCommuteData(model));
            model.propertyFileListeners.push(() => Controller.loadRentData(model));
        }
    }

    /**
     * An interface for objects in the shortname file.
     */
    interface ShortName {
        name: string;
        shortname: string;
    }

    /**
     * Constants used by the Controller class.
     */
    class ControllerConstants {
        public static defaultArrivalTime: number = 480;
        public static defaultDestination: string = "Barbican";
        public static defaultPropertyFile: string = "2-bedroom-rents.json";

        public static rentStatsFolder: string = "preprocessor-output/processed-rents/";
        public static departureTimesFolder: string = "preprocessor-output/processed-departure-times/";

        public static shortnameFile: string = "short-names.json";
    }
}

module CommutesAndRent {
    
    /**
     * Manages the slider controls for property type and arrival time. 
     */
    export class SlidersController {

        /**
         * Creates the slider controls and registers events with them that will update the model.
         */ 
        constructor(model: Model) {
            SlidersController.makeTimeSlider(model);
            SlidersController.makePropertyTypeSlider(model);
        }

        // Creates the arrival time slider control and registers an event with it that'll update Model.arrivalTime.
        private static makeTimeSlider(model: Model) {

            // Create a scale and axis for the slider with ticks formatted as am/pm times.
            var scale = d3.scale.ordinal()
                .domain(d3.range(SliderConstants.minTime, SliderConstants.maxTime, SliderConstants.stepTime))
                .rangePoints([0, $("#timeslider").width()]);

            var axis = d3.svg.axis()
                .scale(scale)
                .tickValues(d3.range(SliderConstants.minTime + 2, SliderConstants.maxTime + 1, SliderConstants.tickInterval * SliderConstants.stepTime))
                .tickFormat(t => SlidersController.formatHour(t));

            // Create a slider object using the d3.slider library and register an event that'll update Model.ArrivalTime.
            var slider: any = d3.slider()
                .min(SliderConstants.minTime).max(SliderConstants.maxTime).step(SliderConstants.stepTime)
                .value(SliderConstants.minutesToHours(model.arrivalTime))
                .axis(axis)
                .on("slide", (event, value) => model.arrivalTime = SliderConstants.hoursToMinutes(value));

            // Add the slider to the DOM.
            d3.select("#timeslider").call(slider);
        }

        // Take an hour value and format it as am/pm.
        private static formatHour(t: number) {

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
        }

        // Creates the property type slider and registers an event with it that'll update Model.propertyFile.
        private static makePropertyTypeSlider(model: Model) {

            // Create a scale and axis for the slider with ticks formatted with SliderConstants.propertyTypes.
            var scale = d3.scale.ordinal()
                .domain(d3.range(0, SliderConstants.propertyTypes.length - 1, 1))
                .rangePoints([0, $("#bedroomslider").width()]);

            var axis = d3.svg.axis()
                .scale(scale)
                .tickValues(d3.range(0, SliderConstants.propertyTypes.length, 1))
                .tickFormat(d => SliderConstants.propertyTypes[d]);

            // Create a slider object using the d3.slider library and registed an event to update Model.propertyFile.
            var slider: any = d3.slider()
                .min(0).max(SliderConstants.propertyTypes.length - 1).step(1)
                .value(SliderConstants.rentFilenames.indexOf(model.propertyFile))
                .axis(axis)
                .on("slide", (event, value) => model.propertyFile = SliderConstants.rentFilenames[value]);

            // Add the slider to the DOM.
            d3.select("#bedroomslider").call(slider);
        }

    }

    /**
     * Constants used in the SlidersControl class.
     */
    class SliderConstants {
        public static minTime: number = 7;
        public static maxTime: number = 24;
        public static stepTime: number = 1;
        public static tickInterval: number = 3;

        // These two functions convert to and from the time format the commute data uses, which is the number of minutes since 1am.
        // (It's number of minutes because the TransXChange files the preprocessor eats have times incremented by the 
        // minute, and since there're ~7,000 commute time files brevity is valuable. It's minutes since 1am because the TransXChange model's
        // XMLGregorianCaledar.timeInMillis() method counts from 1am for reasons beyond me. Possibly to do with daylight savings)
        public static hoursToMinutes: (number) => number = n => 60 * (n - 1);
        public static minutesToHours: (number) => number = n => n / 60 + 1;
        
        public static propertyTypes: string[] = ["Room", "Studio", "1 bed", "2 bed", "3 bed", "4+ bed"];
        public static rentFilenames: string[] = ["room-rents.json", "studio-rents.json", "1-bedroom-rents.json", "2-bedroom-rents.json", "3-bedroom-rents.json", "4-bedroom-rents.json"];
    }
}

module CommutesAndRent {
    
    /**
     * Manages the map of stations.
     */
    export class MapView {

        private currentHighlightedMarkers: L.Marker[] = [];
        private currentNullMarkers: L.Marker[] = [];
        private currentDestinationMarker: L.Marker = null;
        
        private markerLookup: D3.Map; // This is a hashmap, nothing to do with geographic maps.
        private mapObject: L.Map;
        private model: Model;

        /**
         * Instantiates a map of stations, and registers functions with the model that will update various fields
         * when markers are moused over, become a destination, are moved to or when they refer to null data points.
         */ 
        constructor(model: Model) {
            this.model = model;
            this.mapObject = MapView.makeMapObject();

            // Load location data and use it to place markers on the map and build a station name -> marker hashmap.
            // Then register events with the model for highlighted markers, for changes of destination, for and 
            // requests that the map center on a station.
            Q($.getJSON(MapConstants.locationDataPath))
                .then(data => {
                    this.markerLookup = this.addMarkers(data);
                    this.highlightDestination();
                    this.model.highlightListeners.push(() => this.highlightMarkers());
                    this.model.destinationListeners.push(() => this.highlightDestination());
                    this.model.dataUpdateListeners.push(() => this.nullMarkers());
                    this.model.moveToListeners.push(name => this.moveTo(name));
                });
        }

        // Create the map object using the Leaflet library.
        private static makeMapObject(): L.Map {
            var map: L.Map = L.map("map").setView(MapConstants.defaultCenter, MapConstants.defaultZoom);

            // Load the tile layer for the map.
            new L.TileLayer(MapConstants.mapTileURLTemplate, { mapid: MapConstants.mapId }).addTo(map);

            return map;
        }

        // Place map markers at the listed locations and register click & mouseover events on them. Also constructs and 
        // returns a hashmap that takes station names to their corresponding markers.
        private addMarkers(locations: Location[]): D3.Map {
            var result = d3.map();

            for (var i: number = 0; i < locations.length; i++)
            {
                var name = locations[i].name;
                var latLng: L.LatLng = new L.LatLng(locations[i].latitude, locations[i].longitude);

                // Create a marker at the latitude & longitude of the location, 
                var marker: L.Marker = new StationMarker(name, latLng, { icon: MapConstants.defaultIcon, title: name })
                    .addTo(this.mapObject)
                    .on("click", (e: L.LeafletMouseEvent) => this.model.destination = e.target.name)
                    .on("mouseover", (e: L.LeafletMouseEvent) => this.model.highlighted = [e.target.name]);

                result.set(name, marker);
            }

            return result;
        }

        // When called, updates the highlighted markers on the map to match the names in this.model.highlighted.
        private highlightMarkers(): void {
            // Un-highlight every currently highlighted marker, giving them back the correct icons.
            //TODO: This is ugly as sin. Come up with a better way.
            this.currentHighlightedMarkers.forEach(marker => {
                if (marker === this.currentDestinationMarker) {
                    marker.setIcon(MapConstants.destinationIcon);
                } else if (this.currentNullMarkers.some(n => n === marker)) {
                    marker.setIcon(MapConstants.nullIcon);
                } else {
                    marker.setIcon(MapConstants.defaultIcon);
                }
            });

            // Highlight each marker whose name is listed in this.model.highlighted.
            var markers = this.model.highlighted
                .map(name => this.markerLookup.get(name))

            markers.forEach(marker => {
                marker.setIcon(MapConstants.highlightIcon);
            });

            this.currentHighlightedMarkers = markers;
        }

        // When called, updates the marker currently with the destination icon to match this.mode.destination.
        private highlightDestination(): void {
            // Set the current destination marker back to its default icon.
            if (this.currentDestinationMarker !== null) {
                this.currentDestinationMarker.setIcon(MapConstants.defaultIcon);
            }

            // Update the marker corresponding to this.model.destination to have the destination marker icon.
            var marker = this.markerLookup.get(this.model.destination);
            marker.setIcon(MapConstants.destinationIcon);

            this.currentDestinationMarker = marker;
        }

        // When called, updates the set of markers with the null data icon to match the stations with null rent data.
        private nullMarkers(): void {
            // Set every marker currently with a null icon back to their original icons.
            //TODO: This is ugly as sin. Come up with a better way.
            this.currentNullMarkers.forEach(marker => {
                if (marker === this.currentDestinationMarker) {
                    marker.setIcon(MapConstants.destinationIcon);
                } else {
                    marker.setIcon(MapConstants.defaultIcon);
                }
            });
           
            // Update each marker whose name has missing rent data to the null data icon.
            var markers = this.model.rents
                .filter(rent => rent.median === null)
                .map(rent => this.markerLookup.get(rent.name));

            markers.forEach(marker => {
                marker.setIcon(MapConstants.nullIcon);
            });

            this.currentNullMarkers = markers;
        }

        // Recenter the map over the named station.
        private moveTo(name: string): void {
            var center = this.markerLookup.get(name).getLatLng();
            this.mapObject.setView(center, MapConstants.defaultZoom);
        }
    }

    /**
     *  A TypeScript interface for the objects in the location data file.
     */
    interface Location {
        name: string;
        longitude: number;
        latitude: number;        
    }

    /**
     * A subclass of Leaflet's L.Marker that adds a name field.
     */
    class StationMarker extends L.Marker {
        public name: string;

        // A proxy for L.Marker's constructor.
        constructor(name: string, latLng: L.LatLng, options?: any) {
            super(latLng, options);

            this.name = name;
        }
    }

    /**
     * Constants for the MapView class.
     */
    class MapConstants {
        public static mapTileURLTemplate: string = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        public static mapId: string = "coffeetable.hinlda0l";

        public static locationDataPath: string = "preprocessor-output/processed-locations/locations.json";

        public static defaultCenter: L.LatLng = new L.LatLng(51.505, -0.09);
        public static defaultZoom: number = 13;
        
        public static defaultIcon: L.Icon = L.icon({ iconUrl: "icons/default-icon.png", prototype: MapConstants.commonIconOptions });
        public static highlightIcon: L.Icon = L.icon({ iconUrl: "icons/highlighted-icon.png", prototype: MapConstants.commonIconOptions });
        public static destinationIcon: L.Icon = L.icon({ iconUrl: "icons/destination-icon.png", prototype: MapConstants.commonIconOptions });
        public static nullIcon: L.Icon = L.icon({ iconUrl: "icons/null-icon.png", prototype: MapConstants.commonIconOptions });

        private static commonIconOptions = { iconAnchor: new L.Point(16, 34), shadowUrl: "shadow-icon.png", shadowAnchor: new L.Point(23, 35) };
    }
}

module CommutesAndRent {

    /**
     * Manages the chart of rents vs commute times.
     */
    export class ChartView {
        private model: Model;
        private data: RentTime[];

        private graphics: Graphics;

        private currentlyExpanded: number = null;

        /**
         * Instantiates a chart of rents vs commute times using the data held in the model, and registers events
         * on the model that will cause the chart to update when the model's data is.
         */
        constructor(model: Model) {
            this.initialize(model);

            model.dataUpdateListeners.push(() => this.update());
            model.highlightListeners.push(() => this.highlightStations());
            model.destinationListeners.push(() => this.highlightDestination());
        }

        // Sets the this.model and this.data fields, and creates the DOM elements that'll be used to display the data.
        // Then calls this.update(), which provides the positioning for the DOM elements.
        private initialize(model: Model): void {
            this.model = model;
            this.data = ChartView.generateDataset(this.model.rents, this.model.commutes);

            // Create a <g> SVG element for each item in this.data.
            var selection = d3.select("#chart").selectAll(".bargroup").data(this.data).enter().append("g");

            // Give the <g> elements a class that they can later be referenced by, and attaches click & mouseover events to
            // each one.
            selection
                .classed("bargroup", true)
                .on('click', d => this.clickedOn(d))
                .on('mouseover', d => this.model.highlighted = this.getStationsToHighlight(d));

            // Add geometric elements to each <g> element that'll be used to display the data.
            selection.append("rect").classed("background", true);
            selection.append("rect").classed("rect", true);
            selection.append("line").classed("median", true);
            selection.append("text").classed("label", true);

            this.update();
        }

        // Generates an array of RentTimes from the provided data, which contain the rent and commute time statistics for each station.
        private static generateDataset(rents: RentStatistic[], commutes: CommuteTimes): RentTime[]{
            // Build a hashmap that takes station names to the time needed to commute there. 
            var commuteLookup: D3.Map = commutes.times.reduce((m: D3.Map, d: DepartureTime) => { m.set(d.station, commutes.arrivalTime - d.time); return m; }, d3.map());
            
            // Combine the rent data with the commute times.
            var rentTimes: RentTime[] = rents.map(rent => new RentTime(rent, commuteLookup.get(rent.name)));

            return rentTimes;
        }

        // Get a list of the names of the stations whose elements should be highlighted.
        private getStationsToHighlight(mouseoveredData: RentTime): string[]{
            // If the mouseover'd element is part of the expanded selection, return the name of it alone.
            // If the mouseover'd element isn't currently expanded, return the names of every element sharing its line.
            if (mouseoveredData.time === this.currentlyExpanded) {
                return [mouseoveredData.name];
            } else {
                return this.data.filter(e => e.time === mouseoveredData.time && e.time !== this.currentlyExpanded).map(e => e.name);
            }
        } 

        // Generates new this.data and this.graphics using the current model data, then updates the chart elements to reflect that data.
        private update(): void {
            this.data = ChartView.generateDataset(this.model.rents, this.model.commutes);
            this.graphics = new Graphics(this.data, this.model.shortNames);

            // Attach the new data to the chart's bargroup elements, using the station name to match.
            var selection = d3.selectAll(".bargroup").data(this.data, rentTime => rentTime.name);

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
        }

        // Deals with clicks on the chart's bars. 
        // If passed a datapoint that's already expanded, it moves the map to the corresponding station.
        // If passed a datapoint that isn't already expanded, it expands the corresponding time.
        // If passed null, it'll collapse any bars that are currently expanded.
        private clickedOn(datapoint: RentTime): void {
            if (datapoint !== null && datapoint.time === this.currentlyExpanded) {
                this.model.moveTo(datapoint.name);
            } else if (datapoint !== null && this.currentlyExpanded === null) {
                this.expandTime(datapoint.time);
            } else {
                this.expandTime(null);
            }
        }

        // Expands a time, splaying out the bars corresponding to that time.
        // If passed null, it'll collapse any bars that are currently expanded.
        private expandTime(time: number): void {
            var selection = d3.selectAll(".bargroup");

            // Update the "expanded" and "notexpanded" element classes, which are used for visual highlighting with CSS.
            selection.classed("expanded", d => d.time === time);
            selection.classed("notexpanded", d => (time !== null) && (d.time !== time));

            // Update the positions of the bars.
            selection.transition().attr(this.graphics.groupPositionAttrs(time));

            // Update the bar's labels.
            selection.select(".label").text(this.graphics.labelText(time));

            // Mark the y-axis as "suppressed" if a group is being expanded.
            d3.select(".y.axis").classed("suppressed", time !== null);
            
            this.currentlyExpanded = time;
        }

        // Update the set of chart elements in the "highlighted" class to match this.model.highlighted.
        // If there's a single highlighted element, it'll also bring it to the front of the scene.
        private highlightStations() {
            var selection = d3.selectAll(".bargroup")
                .classed("highlighted", d => this.model.highlighted.some(name => name === d.name));

            // If there's a single highlighted station, sort the elements in the selection to bring the highlighted 
            // one to the front:
            if (this.model.highlighted.length === 1) {
                var name = this.model.highlighted[0];
                selection.sort((a: RentTime, b: RentTime) => a.name === name ? 1 : (b.name === name ? -1 : 0));
            } 
        }

        // Update the chart element in the "destination" class to match this.model.destination and bring that element 
        // to the front of the scene.
        private highlightDestination() {
            var name = this.model.destination;

            var selection = d3.selectAll(".bargroup")
                .classed("destination", d => d.name === name);

            // Sort the elements in the selection to bring the destination to the front:
            selection.sort((a: RentTime, b: RentTime) => a.name === name ? 1 : (b.name === name ? -1 : 0)); 
        }

        // Update the set of chart elements in the "nulldata" class to match the datapoints with null medians.
        private highlightNullData() {
            var selection = d3.selectAll(".bargroup")
                .classed("nulldata", d => d.median === null);
        }
    }

    /**
     * A single chart datapoint, containing both rent data for a station and the commute time to it.
     */
    class RentTime implements RentStatistic {
        name: string;
        lowerQuartile: number;
        median: number;
        upperQuartile: number;

        time: number;

        constructor(rentStat: RentStatistic, time: number) {
            this.name = rentStat.name;
            this.lowerQuartile = rentStat.lowerQuartile;
            this.median = rentStat.median;
            this.upperQuartile = rentStat.upperQuartile;

            this.time = time;
        }
    }

    /**
     * Provides methods that map RentTime datapoints to SVG attributes that can be applied to chart elements.
     */
    class Graphics {

        private xScale: D3.Scale.LinearScale;
        private yScale: D3.Scale.LinearScale;

        private sizes: D3.Map = d3.map();
        private indices: D3.Map = d3.map();

        private chartWidth: number;

        private shortnames: D3.Map;

        /**
         * Constructs a set of RentTime -> graphical attribute methods using the given data and short names.
         */
        constructor(dataset: RentTime[], shortnames: D3.Map) {
            this.chartWidth = $("#chart").width();
            $("#chart").height(ChartConstants.pixelsPerMinute * ChartConstants.yScaleDomainMax);

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
        private calculateYOffsets(dataset: RentTime[]): void {

            // Pull null data to the start of the array, so when it's displayed its graphical elements will be drawn 
            // first (and hence be at the back).
            var sorted = dataset.sort((a, b) => a.median === null? 1 : (b.median === null? -1 : a.median - b.median));

            for (var i: number = 0; i < dataset.length; i++) {
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
        }

        /**
         * Returns an attributes object for the rectangle that represents a datapoint.
         */
        public rectAttrs(): any {
            return {
                x: (d: RentTime) => d.median !== null? this.xScale(d.lowerQuartile) : ChartConstants.margins.left,
                height: () => ChartConstants.pixelsPerMinute - ChartConstants.barSpacing,
                width: (d: RentTime) => d.median !== null ? this.xScale(d.upperQuartile) - this.xScale(d.lowerQuartile) : this.chartWidth - (ChartConstants.margins.right + ChartConstants.margins.left)
            };
        }

        /**
         * Returns an attributes object for the line that represents a datapoint's median.
         */
        public medianAttrs(): any {
            return {
                x1: (d: RentTime) => this.xScale(d.median),
                y1: 0,
                x2: (d: RentTime) => this.xScale(d.median),
                y2: ChartConstants.pixelsPerMinute - ChartConstants.barSpacing
            };
        }

        /**
         * Returns an attributes object for the group that represents a datapoint.
         */
        public groupPositionAttrs(expandedTime: number): any {
            return {
                transform: (d: RentTime) => "translate(0," + this.yScale(this.offset(d, expandedTime) - 0.5) + ")"
            };
        }

        // Calculates the possibly-offset time for a datapoint, taking into account which times have been expanded.
        private offset(d: RentTime, expandedTime: number): number {
            // If no time has been expanded, or if the time expanded is greater than the datapoint in question, just return 
            // the datapoint's time.
            // If the expanded time is the same as the datapoint's time, return the datapoint's time offset by it's 
            // index in the set of datapoints that have the same time.
            // If the expanded time is less than the datapoint's time, return the datapoint's time plus the number of places it
            // needs to be moved down by. 
            if (expandedTime === null || d.time < expandedTime) {
                return d.time;
            }
            else if (d.time === expandedTime) {
                return d.time + this.indices[d.name];
            } else {
                return d.time + (this.sizes[expandedTime] - 1);
            }
        }

        /**
         * Returns an attributes object for the background rectangle that represents a datapoint.
         */
        public backgroundAttrs(): any {
            return {
                x: ChartConstants.margins.left,
                width: this.chartWidth - ChartConstants.margins.left,
                height: ChartConstants.pixelsPerMinute - ChartConstants.barSpacing
            };
        }

        /**
         * Returns an attributes object for the label that represents a datapoint.
         */
        public labelAttrs(): any {
            return {
                x: () => this.chartWidth - ChartConstants.margins.right + ChartConstants.xLabelOffset,
                y: () => ChartConstants.pixelsPerMinute - ChartConstants.barSpacing - ChartConstants.yLabelOffset
            };
        }

        /**
         * Returns the text for a label that represents a datapoint.
         */
        public labelText(expandedTime: number): (d: RentTime) => string {
            return (d: RentTime) => {
                if (d.time === expandedTime || (this.indices[d.name] === 0 && this.sizes[d.time] === 1)) {
                    return this.shortnames.get(d.name) || d.name;
                } else if (this.indices[d.name] === 0 && this.sizes[d.time] > 1) {
                    return "+";
                } else {
                    return "";
                }
            };
        }
    }

    /**
     * Static methods to construct a rent and commute time scales.
     */
    class ScaleBuilders {

        /**
         * Construct a linear scale of rents spanning from the lowest rent lower quartile to the greatest upper quartile.
         */ 
        public static makeXScale(dataset: RentTime[], chartWidth: number): D3.Scale.LinearScale {
            var lowestRent: number = d3.min(dataset, stat => stat.lowerQuartile);
            var highestRent: number = d3.max(dataset, stat => stat.upperQuartile);

            return d3.scale.linear()
                .domain([lowestRent, highestRent])
                .rangeRound([ChartConstants.margins.left, chartWidth - ChartConstants.margins.right])
                .nice();
        }

        /**
         * Construct a linear scale of times spanning from 0 to ChartConstants.yScaleDomainMax.
         */ 
        public static makeYScale(): D3.Scale.LinearScale {
            return d3.scale.linear()
                .domain([0, ChartConstants.yScaleDomainMax])
                .rangeRound([ChartConstants.margins.top, ChartConstants.pixelsPerMinute * ChartConstants.yScaleDomainMax - ChartConstants.margins.bottom])
                .nice();
        }
    }

    /**
     * Static methods to construct rent and commute time axes.
     */
    class AxisBuilders {

        /**
         * Construct and draw the X (rent) axis.
         */ 
        public static makeXAxis(xScale: D3.Scale.LinearScale): void {
            var axis: D3.Svg.Axis = d3.svg.axis()
                .scale(xScale)
                .orient("top")
                .ticks(5);

            d3.select(".x.axis")
                .attr("transform", "translate(0," + ChartConstants.xAxisOffset + ")")
                .transition()
                .call(axis);

            AxisBuilders.makeXLabel(xScale);
        }

        private static makeXLabel(xScale: D3.Scale.LinearScale): void {
            if ($(".x.label").length === 0) {
                var midpoint = (xScale.range()[0] + xScale.range()[1]) / 2;

                d3.select(".x.axis").append("text")
                    .classed("x label", true)
                    .attr("transform", "translate(" + midpoint + "," + ChartConstants.xAxisLabelYOffset + ")")
                    .attr("text-anchor", "middle")
                    .text("Rent Range (£/month)");
            }
        }

        /**
         * Construct and draw the Y (commute time) axis.
         */ 
        public static makeYAxis(yScale: D3.Scale.LinearScale): void {
            var axis: D3.Svg.Axis = d3.svg.axis()
                .scale(yScale)
                .orient("left");

            d3.select(".y.axis")
                .attr("transform", "translate(" + ChartConstants.yAxisOffset + ",0)")
                .transition()
                .call(axis);

            AxisBuilders.makeYLabel(yScale);
        }

        private static makeYLabel(yScale: D3.Scale.LinearScale): void {
            if ($(".y.label").length === 0) {
                var midpoint = $("#app").height() / 2;

                d3.select(".y.axis").append("text")
                    .classed("y label", true)
                    .attr("transform", "translate(" + ChartConstants.yAxisLabelXOffset + "," + midpoint + "), rotate(-90)")
                    .attr("text-anchor", "middle")
                    .text("Commute Time (mins)");
            }
        }
    }

    /**
     * Constants for the ChartView class & supporting classes.
     */ 
    class ChartConstants {
        public static pixelsPerMinute: number = 15;
        public static barSpacing: number = 2;

        public static margins: any = { top: 50, right: 130, bottom: 50, left: 60 };

        public static xAxisOffset: number = 40;
        public static yAxisOffset: number = 50;

        public static xAxisLabelYOffset: number = -25;
        public static yAxisLabelXOffset: number = -32;

        public static yLabelOffset: number = 3;
        public static xLabelOffset: number = 10;

        public static yScaleDomainMax: number = 120;
    }

}

module CommutesAndRent {

    /**
     * The model for the app. Holds all data that's shared between components, and allows components to register for 
     * updates when its data fields change.
     */ 
    export class Model {

        // Listeners and field for recentering the map.
        public moveToListeners: { (string): void; }[] = [];
        public moveTo(name: string) { this.moveToListeners.forEach(l => l(name)); }

        // Listeners, accessors and field for the propertyFile used.
        public propertyFileListeners: { (): void; }[] = [];
        private _propertyFile: string;
        public get propertyFile(): string { return this._propertyFile; }
        public set propertyFile(value: string) { this._propertyFile = value; this.propertyFileListeners.forEach(l => l()); }

        // Listeners, accessors and field for the arrival time.
        public arrivalTimeListeners: { (): void; }[] = [];
        private _arrivalTime: number;
        public get arrivalTime(): number { return this._arrivalTime; }
        public set arrivalTime(value: number) { this._arrivalTime = value; this.arrivalTimeListeners.forEach(l => l()); }

        // Listeners, accessors and field for the names of the set of highlighted stations.
        public highlightListeners: { (): void; }[] = [];
        private _highlighted: string[] = [];
        public get highlighted(): string[] { return this._highlighted; }
        public set highlighted(value: string[]) { this._highlighted = value; this.highlightListeners.forEach(l => l()); }

        // Listeners, accessors and field for the destination station name.
        public destinationListeners: { (): void; }[] = [];
        private _destination: string;
        public get destination(): string { return this._destination; }
        public set destination(value: string) { this._destination = value; this.destinationListeners.forEach(l => l()); }

        // Listeners, accessors and field for the rent and commute data that's loaded.
        public dataUpdateListeners: { (): void; }[] = [];
        private _rents: RentStatistic[];
        public get rents(): RentStatistic[] { return this._rents; }
        public set rents(value: RentStatistic[]) { this._rents = value; this.dataUpdateListeners.forEach(l => l()); }
        private _commutes: CommuteTimes;
        public get commutes(): CommuteTimes { return this._commutes; }
        public set commutes(value: CommuteTimes) { this._commutes = value; this.dataUpdateListeners.forEach(l => l()); }

        // The name to short name hashmap.
        public shortNames: D3.Map = d3.map();
    }

    /**
     * An interface for the JSON arrays stored in the rent files.
     */ 
    export interface RentStatistic {
        name: string;
        lowerQuartile: number;
        median: number;
        upperQuartile: number;
    }

    /**
     * An interface for the JSON object stored in the commute time files.
     */ 
    export interface CommuteTimes {
        arrivalTime: number;
        destination: string;
        times: DepartureTime[];
    }

    /**
     * An interface for the departure time field of the CommuteTimes JSON object .
     */ 
    export interface DepartureTime {
        station: string;
        time: number;
    }
}
