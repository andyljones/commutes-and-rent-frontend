window.onload = () => {
    var controller: CommutesAndRent.Controller = new CommutesAndRent.Controller();
};

declare function d3slider(): any;

declare module D3 {
    module Svg {
        export interface Brush {
            clamp(clamp: boolean): D3.Svg.Brush;
        }
    }
}

module CommutesAndRent {
        
    export class SlidersController {

        private model: Model;

        constructor(model: Model) {
            this.model = model;

            this.makeTimeSlider();
            this.makeBedroomCountSlider();
        }

        private makeTimeSlider() {
            var slider: any = d3slider()
                .min(SliderConstants.minTime).max(SliderConstants.maxTime).step(SliderConstants.stepTime)
                .value(SliderConstants.minutesToHours(this.model.arrivalTime))
                .on("slide", (event, value) => this.model.arrivalTime = SliderConstants.hoursToMinutes(value));

            var scale = d3.scale.ordinal()
                .domain(d3.range(SliderConstants.minTime, SliderConstants.maxTime, SliderConstants.stepTime))
                .rangePoints([0, $("#timeslider").width()]);

            var axis = d3.svg.axis()
                .scale(scale)
                .tickValues(d3.range(SliderConstants.minTime, SliderConstants.maxTime + 1, SliderConstants.stepTime));

            slider.axis(axis);

            d3.select("#timeslider").call(slider);


        }

        private makeBedroomCountSlider() {
            var slider: any = d3slider()
                .min(0).max(SliderConstants.propertyTypes.length - 1).step(1)
                .value(SliderConstants.rentFilenames.indexOf(this.model.propertyFile))
                .on("slide", (event, value) => this.model.propertyFile = SliderConstants.rentFilenames[value]);

            var scale = d3.scale.ordinal()
                .domain(d3.range(0, SliderConstants.propertyTypes.length - 1, 1))
                .rangePoints([0, $("#bedroomslider").width()]);

            var axis = d3.svg.axis()
                .scale(scale)
                .tickValues(d3.range(0, SliderConstants.propertyTypes.length, 1))
                .tickFormat(d => SliderConstants.propertyTypes[d]);

            slider.axis(axis);

            d3.select("#bedroomslider").call(slider);
        }

    }

    class SliderConstants {
        public static minTime: number = 7;
        public static maxTime: number = 24;
        public static stepTime: number = 1;
        public static hoursToMinutes: (number) => number = n => 60 * (n - 1);
        public static minutesToHours: (number) => number = n => n/60 + 1;

        public static propertyTypes: string[] = ["Room", "Studio", "1 bedroom", "2 bedrooms", "3 bedrooms", "4+ bedrooms"];
        public static rentFilenames: string[] = ["room-rents.json", "studio-rents.json", "1-bedroom-rents.json", "2-bedroom-rents.json", "3-bedroom-rents.json", "4-bedroom-rents.json"];
    }
}

module CommutesAndRent {
    
    export class MapView {
        private markerLookup: D3.Map = d3.map();

        private currentHighlightedMarkers: L.Marker[] = [];
        private currentNullMarkers: L.Marker[] = [];
        private currentDestinationMarker: L.Marker = null;
        
        private mapObject: L.Map;
        private model: Model;

        constructor(model: Model) {
            this.mapObject = MapView.makeMapObject();

            this.model = model;

            Q($.getJSON(MapConstants.locationDataPath))
                .then(data => {
                    this.addMarkers(data);
                    this.highlightDestination();
                    this.model.highlightListeners.push(() => this.highlightMarkers());
                    this.model.destinationListeners.push(() => this.highlightDestination());
                    this.model.dataUpdateListeners.push(() => this.nullMarkers());
                    this.model.moveToListeners.push(name => this.moveTo(name));
                });
        }

        private static makeMapObject(): L.Map {
            var map: L.Map = L.map("map").setView(MapConstants.defaultCenter, MapConstants.defaultZoom);

            new L.TileLayer(MapConstants.mapTileURLTemplate, { mapid: MapConstants.mapId }).addTo(map);

            return map;
        }

        private addMarkers(locations: Location[]): void {
            for (var i: number = 0; i < locations.length; i++)
            {
                var latLng: L.LatLng = new L.LatLng(locations[i].latitude, locations[i].longitude);

                var marker: L.Marker = new StationMarker(locations[i].name, latLng, { icon: MapConstants.defaultIcon })
                    .addTo(this.mapObject)
                    .on("click", (e: L.LeafletMouseEvent) => this.model.destination = e.target.name)
                    .on("mouseover", (e: L.LeafletMouseEvent) => this.model.highlighted = [e.target.name]);

                this.markerLookup.set(locations[i].name, marker);
            }
        }

        private highlightMarkers(): void {
            var names = this.model.highlighted; 

            this.currentHighlightedMarkers.forEach(marker => {
                if (marker === this.currentDestinationMarker) {
                    marker.setIcon(MapConstants.destinationIcon);
                } else if (this.currentNullMarkers.some(n => n === marker)) {
                    marker.setIcon(MapConstants.nullIcon);
                } else {
                    marker.setIcon(MapConstants.defaultIcon);
                }
            });

            var markers = names.map(name => this.markerLookup.get(name));

            markers.forEach(marker => {
                marker.setIcon(MapConstants.highlightIcon);
            });

            this.currentHighlightedMarkers = markers;
        }

        private highlightDestination(): void {
            var name = this.model.destination;

            if (this.currentDestinationMarker !== null) {
                this.currentDestinationMarker.setIcon(MapConstants.defaultIcon);
            }

            var marker = this.markerLookup.get(name);
            marker.setIcon(MapConstants.destinationIcon);

            this.currentDestinationMarker = marker;
        }

        private nullMarkers(): void {
            var names = this.model.rents.filter(rent => rent.median === null).map(rent => rent.name); 

            this.currentNullMarkers.forEach(marker => {
                if (marker === this.currentDestinationMarker) {
                    marker.setIcon(MapConstants.destinationIcon);
                } else {
                    marker.setIcon(MapConstants.defaultIcon);
                }
            });

            var markers = names.map(name => this.markerLookup.get(name));

            markers.forEach(marker => {
                marker.setIcon(MapConstants.nullIcon);
            });

            this.currentNullMarkers = markers;
        }

        private moveTo(name: string): void {
            var center = this.markerLookup.get(name).getLatLng();
            this.mapObject.setView(center, MapConstants.defaultZoom);
        }
    }

    interface Location {
        name: string;
        longitude: number;
        latitude: number;        
    }

    class StationMarker extends L.Marker {
        public name: string;

        constructor(name: string, latLng: L.LatLng, options?: any) {
            super(latLng, options);

            this.name = name;
        }
    }

    class MapConstants {
        public static mapTileURLTemplate: string = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        public static mapId: string = "coffeetable.hinlda0l";
        
        public static defaultCenter: L.LatLng = new L.LatLng(51.505, -0.09);
        public static defaultZoom: number = 13;
        
        public static defaultIcon: L.Icon = L.icon({ iconUrl: "default-icon.png", iconAnchor: new L.Point(16, 34), shadowUrl: "shadow-icon.png", shadowAnchor: new L.Point(23, 35) });
        public static highlightIcon: L.Icon = L.icon({ iconUrl: "highlighted-icon.png", iconAnchor: new L.Point(16, 34), shadowUrl: "shadow-icon.png", shadowAnchor: new L.Point(23, 35) });
        public static destinationIcon: L.Icon = L.icon({ iconUrl: "destination-icon.png", iconAnchor: new L.Point(16, 34), shadowUrl: "shadow-icon.png", shadowAnchor: new L.Point(23, 35) });
        public static nullIcon: L.Icon = L.icon({ iconUrl: "null-icon.png", iconAnchor: new L.Point(16, 34), shadowUrl: "shadow-icon.png", shadowAnchor: new L.Point(23, 35) });

        public static locationDataPath: string = "preprocessor-output/processed-locations/locations.json";
    }
}

module CommutesAndRent {

    export class Model {

        public moveToListeners: { (string): void; }[] = [];
        public moveTo(name: string) { this.moveToListeners.forEach(l => l(name)); }

        public propertyFileListeners: { (): void; }[] = [];
        private _propertyFile: string;
        public get propertyFile(): string { return this._propertyFile; }
        public set propertyFile(value: string) { this._propertyFile = value; this.propertyFileListeners.forEach(l => l()); }

        public arrivalTimeListeners: { (): void; }[] = [];
        private _arrivalTime: number;
        public get arrivalTime(): number { return this._arrivalTime; }
        public set arrivalTime(value: number) { this._arrivalTime = value; this.arrivalTimeListeners.forEach(l => l()); }

        public highlightListeners: { (): void; }[] = [];
        private _highlighted: string[] = [];
        public get highlighted(): string[] { return this._highlighted; }
        public set highlighted(value: string[]) { this._highlighted = value; this.highlightListeners.forEach(l => l()); }

        public destinationListeners: { (): void; }[] = [];
        private _destination: string;
        public get destination(): string { return this._destination; }
        public set destination(value: string) { this._destination = value; this.destinationListeners.forEach(l => l()); }

        public dataUpdateListeners: { (): void; }[] = [];
        private _rents: RentStatistic[];
        public get rents(): RentStatistic[] { return this._rents; } 
        public set rents(value: RentStatistic[]) { this._rents = value; this.dataUpdateListeners.forEach(l => l()); }
        private _commutes: CommuteTimes;
        public get commutes(): CommuteTimes { return this._commutes; }
        public set commutes(value: CommuteTimes) { this._commutes = value; this.dataUpdateListeners.forEach(l => l()); }

        public shortNames: D3.Map = d3.map();
    }

    export interface RentStatistic {
        name: string;
        lowerQuartile: number;
        median: number;
        upperQuartile: number;
    }

    export interface CommuteTimes {
        arrivalTime: number;
        destination: string;
        times: DepartureTime[];
    }

    export interface DepartureTime {
        station: string;
        time: number;
    }
}

module CommutesAndRent {

    export class Controller
    {
        private model: Model;
        private chart: ChartView;
        private map: MapView;
        private sliders: SlidersController;

        constructor() { 

            this.initializeModel()
                .then(model => {
                    this.model = model;
                    this.chart = new ChartView(model);
                    this.map = new MapView(model);
                    this.sliders = new SlidersController(model);
                    this.initializeSelf(model);
                });
        }

        private initializeModel(): Q.Promise<Model> {
            var model = new Model();

            model.arrivalTime = ControllerConstants.defaultArrivalTime;
            model.destination = ControllerConstants.defaultDestination;
            model.propertyFile = ControllerConstants.defaultPropertyFile;

            return Q.all([
                this.loadRentData(model),
                this.loadCommuteData(model),
                this.loadShortNameData(model)
            ]).then(() => Q(model));
        }

        private loadCommuteData(model: Model): Q.Promise<void> {
            var filepath: string = ControllerConstants.departureTimesFolder + model.arrivalTime + "/" + model.destination + ".json";
            return Q($.getJSON(filepath)).then(data => { model.commutes = data; return null; });
        }

        private loadRentData(model: Model): Q.Promise<void> {
            var filepath: string = ControllerConstants.rentStatsFolder + model.propertyFile;
            return Q($.getJSON(filepath)).then(data => { model.rents = data; return null; });
        }

        private loadShortNameData(model: Model): Q.Promise<void> {
            var filepath: string = ControllerConstants.shortnameFile;

            return Q($.getJSON(filepath)).then(data => { model.shortNames = Controller.parseShortNames(data); return null; });
        }

        private static parseShortNames(data: ShortName[]): D3.Map {
            var result = d3.map();

            for (var i = 0; i < data.length; i++) {
                var d = data[i];

                if (d.shortname !== "") {
                    result.set(d.name, d.shortname);
                } else {
                    result.set(d.name, d.name);
                }
            }

            return result;
        }

        private initializeSelf(model: Model): void {
            model.destinationListeners.push(() => this.loadCommuteData(model));
            model.arrivalTimeListeners.push(() => this.loadCommuteData(model));
            model.propertyFileListeners.push(() => this.loadRentData(model));
        }
    }

    interface ShortName {
        name: string;
        shortname: string;
    }

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

    export class ChartView {
        private model: Model;
        private data: RentTime[];

        private graphics: Graphics;

        private currentlyExpanded: number = null;

        constructor(model: Model) {

            this.initialize(model);

            model.dataUpdateListeners.push(() => this.update());
            model.highlightListeners.push(() => this.highlightStations());
            model.destinationListeners.push(() => this.highlightDestination());
        }

        private initialize(model: Model): void {
            this.model = model;
            this.data = ChartView.generateDataset(this.model.rents, this.model.commutes);

            var selection = d3.select("#chart").selectAll(".bargroup").data(this.data).enter().append("g");

            selection
                .classed("bargroup", true)
                .on('click', d => this.expandOrCollapseTime(d))
                .on('mouseover', d => this.model.highlighted = this.getStationsToHighlight(d));

            selection.append("rect").classed("background", true);
            selection.append("rect").classed("rect", true);
            selection.append("line").classed("median", true);
            selection.append("text").classed("label", true);

            this.update();
        }

        private getStationsToHighlight(mouseoveredData: RentTime) {
            if (mouseoveredData.time === this.currentlyExpanded) {
                return [mouseoveredData.name];
            } else {
                return this.data.filter(e => e.time === mouseoveredData.time && e.time !== this.currentlyExpanded).map(e => e.name);
            }
        } 

        private update(): void {
            this.data = ChartView.generateDataset(this.model.rents, this.model.commutes);
            this.graphics = new Graphics(this.data, this.model.shortNames);

            var selection = d3.selectAll(".bargroup").data(this.data, rentTime => rentTime.name);

            selection.select(".rect").transition().attr(this.graphics.rectAttrs());
            selection.select(".median").transition().attr(this.graphics.medianAttrs());
            selection.select(".background").transition().attr(this.graphics.backgroundAttrs());
            selection.select(".label").transition().attr(this.graphics.labelAttrs());

            selection.classed("nulldata", d => d.median === null);

            this.expandOrCollapseTime(null);
            this.highlightStations();
            this.highlightDestination();
        }

        private expandOrCollapseTime(data: RentTime): void {
            if (data !== null && data.time === this.currentlyExpanded) {
                this.model.moveTo(data.name);
            } else if (data !== null && this.currentlyExpanded === null) {
                this.expandTime(data.time);
            } else {
                this.expandTime(null);
            }
        }

        private expandTime(time: number): void {
            var selection = d3.selectAll(".bargroup");

            selection.classed("expanded", d => d.time === time);
            selection.classed("notexpanded", d => (time !== null) && (d.time !== time));

            selection.transition().attr(this.graphics.groupPositionAttrs(time));
            selection.select(".label").text(this.graphics.labelText(time));

            d3.select(".y.axis").classed("suppressed", time !== null);
            
            this.currentlyExpanded = time;
        }

        private static generateDataset(rents: RentStatistic[], commutes: CommuteTimes) {
            var departureLookup: D3.Map = commutes.times.reduce((m: D3.Map, d: DepartureTime) => { m.set(d.station, commutes.arrivalTime - d.time); return m; }, d3.map());
            var rentTimes: RentTime[] = rents.map(rent => new RentTime(rent, departureLookup.get(rent.name)));

            return rentTimes;
        }

        public highlightStations() {
            var selection = d3.selectAll(".bargroup")
                .classed("highlighted", d => this.model.highlighted.some(name => name === d.name));

            // Bring selected node to the front:
            if (this.model.highlighted.length === 1) {
                var name = this.model.highlighted[0];
                selection.sort((a: RentTime, b: RentTime) => a.name === name ? 1 : (b.name === name ? -1 : 0));
            } 
        }

        public highlightDestination() {
            var name = this.model.destination;

            var selection = d3.selectAll(".bargroup")
                .classed("destination", d => d.name === name);

            // Bring selected node to the front:
            selection.sort((a: RentTime, b: RentTime) => a.name === name ? 1 : (b.name === name ? -1 : 0)); 
        }
    }

    export class RentTime implements RentStatistic {
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

    export class Graphics {

        private xScale: D3.Scale.LinearScale;
        private yScale: D3.Scale.LinearScale;

        private sizes: D3.Map = d3.map();
        private indices: D3.Map = d3.map();

        private chartWidth: number;

        private shortnames: D3.Map;

        constructor(dataset: RentTime[], shortnames: D3.Map) {
            this.chartWidth = $("#chart").width();
            this.shortnames = shortnames;

            this.xScale = ScaleBuilders.makeXScale(dataset, this.chartWidth);
            this.yScale = ScaleBuilders.makeYScale(dataset);

            AxisBuilders.makeXAxis(this.xScale);
            AxisBuilders.makeYAxis(this.yScale);
            
            this.calculateYOffsets(dataset);

            Graphics.setChartHeight(dataset);
        }

        private static setChartHeight(dataset: RentTime[]) {
            $("#chart").height(ChartConstants.pixelsPerMinute*ChartConstants.yScaleDomainMax);
        }

        //TODO: This is awful.
        private calculateYOffsets(dataset: RentTime[]): void {
            var sorted = dataset.sort((a, b) => a.median === null? 1 : (b.median === null? -1 : a.median - b.median));

            for (var i: number = 0; i < dataset.length; i++) {

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
        }

        public rectAttrs(): any {
            return {
                x: (d: RentTime) => d.median !== null? this.xScale(d.lowerQuartile) : ChartConstants.margins.left,
                height: () => ChartConstants.pixelsPerMinute - ChartConstants.barSpacing,
                width: (d: RentTime) => d.median !== null ? this.xScale(d.upperQuartile) - this.xScale(d.lowerQuartile) : this.chartWidth - (ChartConstants.margins.right + ChartConstants.margins.left)
            };
        }

        public medianAttrs(): any {
            return {
                x1: (d: RentTime) => this.xScale(d.median),
                y1: 0,
                x2: (d: RentTime) => this.xScale(d.median),
                y2: ChartConstants.pixelsPerMinute - ChartConstants.barSpacing
            };
        }

        public groupPositionAttrs(expandedTime: number): any {
            return {
                transform: (d: RentTime) => "translate(0," + this.yScale(this.offset(d, expandedTime) - 0.5) + ")"
            };
        }

        private offset(d: RentTime, expandedTime: number): number {
            if (expandedTime === null || d.time < expandedTime) {
                return d.time;
            }
            else if (d.time === expandedTime) {
                return d.time + this.indices[d.name];
            } else {
                return d.time + (this.sizes[expandedTime] - 1);
            }
        }

        public backgroundAttrs(): any {
            return {
                x: ChartConstants.margins.left,
                width: this.chartWidth - ChartConstants.margins.left,
                height: ChartConstants.pixelsPerMinute - ChartConstants.barSpacing
            };
        }

        public labelAttrs(): any {
            return {
                x: () => this.chartWidth - ChartConstants.margins.right + ChartConstants.xLabelOffset,
                y: () => ChartConstants.pixelsPerMinute - ChartConstants.barSpacing - ChartConstants.yLabelOffset
            };
        }

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

    export class ScaleBuilders {

        public static makeXScale(dataset: RentTime[], chartWidth: number): D3.Scale.LinearScale {
            var lowestRent: number = d3.min(dataset, stat => stat.lowerQuartile);
            var highestRent: number = d3.max(dataset, stat => stat.upperQuartile);

            return d3.scale.linear()
                .domain([lowestRent, highestRent])
                .rangeRound([ChartConstants.margins.left, chartWidth - ChartConstants.margins.right])
                .nice();
        }

        public static makeYScale(dataset: RentTime[]): D3.Scale.LinearScale {
 
            return d3.scale.linear()
                .domain([0, ChartConstants.yScaleDomainMax])
                .rangeRound([ChartConstants.margins.top, ChartConstants.pixelsPerMinute * ChartConstants.yScaleDomainMax - ChartConstants.margins.bottom])
                .nice();
        }
    }

    class AxisBuilders {

        public static makeXAxis(xScale: D3.Scale.LinearScale): void {
            var axis: D3.Svg.Axis = d3.svg.axis()
                .scale(xScale)
                .orient("top");

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


        public static makeYAxis(yScale: D3.Scale.LinearScale): void {
            var axis: D3.Svg.Axis = d3.svg.axis().scale(yScale).orient("left");

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
