window.onload = () => {
    var controller: CommutesAndRent.Controller = new CommutesAndRent.Controller();
};

declare function d3slider(): any;

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
                .axis(true)
                .min(SliderConstants.minTime).max(SliderConstants.maxTime).step(SliderConstants.stepTime)
                .value(SliderConstants.minutesToHours(this.model.arrivalTime))
                .on("slide", (event, value) => this.model.arrivalTime = SliderConstants.hoursToMinutes(value));

            d3.select("#timeslider").call(slider);
        }

        private makeBedroomCountSlider() {
            var slider: any = d3slider()
                .axis(true)
                .min(SliderConstants.minBedroom).max(SliderConstants.maxBedroom).step(SliderConstants.stepBedroom)
                .value(this.model.bedroomCount)
                .on("slide", (event, value) => this.model.bedroomCount = value);

            d3.select("#bedroomslider").call(slider);
        }

    }

    class SliderConstants {
        public static minTime: number = 7;
        public static maxTime: number = 24;
        public static stepTime: number = 1;
        public static hoursToMinutes: (number) => number = n => 60 * (n - 1);
        public static minutesToHours: (number) => number = n => n/60 + 1;

        public static minBedroom: number = 1;
        public static maxBedroom: number = 4;
        public static stepBedroom: number = 1;
    }
}

module CommutesAndRent {
    
    export class MapView {
        private markerLookup: D3.Map = d3.map();
        private currentlyHighlightedMarker: L.Marker = null;
        
        private mapObject: L.Map;
        private model: Model;

        constructor(model: Model) {
            this.mapObject = MapView.makeMapObject();

            this.model = model;
            this.model.highlightListeners.push(name => this.highlightMarker(name));

            Q($.getJSON(MapConstants.locationDataPath)).then(data => this.addMarkers(data));
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
                    .on("mouseover", (e: L.LeafletMouseEvent) => this.model.highlighted = e.target.name);

                this.markerLookup.set(locations[i].name, marker);
            }
        }

        private highlightMarker(name: string): void {
            if (this.currentlyHighlightedMarker !== null) {
                this.currentlyHighlightedMarker.setIcon(MapConstants.defaultIcon);
            }

            var marker = this.markerLookup.get(name);
            marker.setIcon(MapConstants.highlightIcon);

            this.currentlyHighlightedMarker = marker;
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
        
        public static defaultIcon: L.Icon = L.icon({ iconUrl: "default-icon.png" });
        public static highlightIcon: L.Icon = L.icon({ iconUrl: "highlighted-icon.png" });
        
        public static locationDataPath: string = "preprocessor-output/processed-locations/locations.json";
    }
}

module CommutesAndRent {

    export class Model {
        public bedroomCountListeners: { (count: number): void; }[] = [];
        private _bedroomCount: number;
        public get bedroomCount(): number { return this._bedroomCount; }
        public set bedroomCount(value: number) { this._bedroomCount = value; this.bedroomCountListeners.forEach(l => l(value)); }

        public arrivalTimeListeners: { (count: number): void; }[] = [];
        private _arrivalTime: number;
        public get arrivalTime(): number { return this._arrivalTime; }
        public set arrivalTime(value: number) { this._arrivalTime = value; this.arrivalTimeListeners.forEach(l => l(value)); }

        public highlightListeners: { (name: string): void; }[] = [];
        private _highlighted: string;
        public get highlighted(): string { return this._highlighted; }
        public set highlighted(value: string) { this._highlighted = value; this.highlightListeners.forEach(l => l(value)); }

        public destinationListeners: { (name: string): void; }[] = [];
        private _destination: string;
        public get destination(): string { return this._destination; }
        public set destination(value: string) { this._destination = value; this.destinationListeners.forEach(l => l(value)); }

        public dataUpdateListeners: { (): void; }[] = [];
        private _rents: RentStatistic[];
        public get rents(): RentStatistic[] { return this._rents; } 
        public set rents(value: RentStatistic[]) { this._rents = value; this.dataUpdateListeners.forEach(l => l()); }
        private _commutes: CommuteTimes;
        public get commutes(): CommuteTimes { return this._commutes; }
        public set commutes(value: CommuteTimes) { this._commutes = value; this.dataUpdateListeners.forEach(l => l()); }
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
            model.bedroomCount = ControllerConstants.defaultNumberOfBedrooms;
            
            return Q.all([
                this.loadRentData(model),
                this.loadCommuteData(model)
            ]).then(() => Q(model));
        }

        private loadCommuteData(model: Model): Q.Promise<void> {
            var filepath: string = ControllerConstants.departureTimesFolder + model.arrivalTime + "/" + model.destination + ".json";
            return Q($.getJSON(filepath)).then(data => { model.commutes = data; return null; });
        }

        private loadRentData(model: Model): Q.Promise<void> {
            var filepath: string = ControllerConstants.rentStatsFolder + model.bedroomCount + "-bedroom-rents.json";
            return Q($.getJSON(filepath)).then(data => { model.rents = data; return null; });
        }

        private initializeSelf(model: Model): void {
            model.destinationListeners.push(name => this.loadCommuteData(model));
            model.arrivalTimeListeners.push(time => this.loadCommuteData(model));
            model.bedroomCountListeners.push(count => this.loadRentData(model));
        }
    }

    class ControllerConstants {
        public static defaultArrivalTime: number = 480;
        public static defaultDestination: string = "Barbican";
        public static defaultNumberOfBedrooms: number = 2;
        
        public static rentStatsFolder: string = "preprocessor-output/processed-rents/";
        public static departureTimesFolder: string = "preprocessor-output/processed-departure-times/";
    }
}

module CommutesAndRent {

    export class ChartView {
        private model: Model;

        private graphics: Graphics;

        private currentlyExpanded: number;
        private currentlyHighlighted: string;

        constructor(model: Model) {
            this.model = model;

            model.dataUpdateListeners.push(() => this.update());
            model.highlightListeners.push(name => this.highlightStation(name));

            this.initialize();
        }

        private initialize(): void {
            var dataset: RentTime[] = ChartView.generateDataset(this.model.rents, this.model.commutes);

            var selection = d3.select("#chart").selectAll(".bargroup").data(dataset).enter().append("g");

            selection
                .classed("bargroup", true)
                .on('click', d => this.expandOrCollapseTime(d.time))
                .on('mouseover', d => this.model.highlighted = d.name);

            selection.append("rect").classed("background", true);
            selection.append("rect").classed("rect", true);
            selection.append("text").classed("label", true);

            this.update(dataset);
        }

        private update(dataset?: RentTime[]): void {
            if (typeof dataset === "undefined") {
                dataset = ChartView.generateDataset(this.model.rents, this.model.commutes);
            }

            this.graphics = new Graphics(dataset);

            var selection = d3.selectAll(".bargroup").data(dataset, rentTime => rentTime.name);

            selection.select(".rect").attr(this.graphics.rectAttrs());
            selection.select(".background").attr(this.graphics.backgroundAttrs());
            selection.select(".label").attr(this.graphics.labelAttrs());

            this.expandOrCollapseTime(null);
            this.highlightStation(this.currentlyHighlighted);
        }

        private expandOrCollapseTime(time: number): void {
            if (time === this.currentlyExpanded) {
                this.expandTime(null);
            } else {
                this.expandTime(time);
            }
        }

        private expandTime(time: number): void {
            var selection = d3.selectAll(".bargroup");

            selection.classed("expanded", d => d.time === time);
            selection.classed("notexpanded", d => (time !== null) && (d.time !== time));

            selection.attr(this.graphics.groupPositionAttrs(time));
            selection.select(".label").text(this.graphics.labelText(time));

            d3.select(".y.axis").classed("suppressed", time !== null);
            
            this.currentlyExpanded = time;
        }

        private static generateDataset(rents: RentStatistic[], commutes: CommuteTimes) {
            var departureLookup: D3.Map = commutes.times.reduce((m: D3.Map, d: DepartureTime) => { m.set(d.station, commutes.arrivalTime - d.time); return m; }, d3.map());
            var rentTimes: RentTime[] = rents.map(rent => new RentTime(rent, departureLookup.get(rent.name)));

            return rentTimes;
        }

        public highlightStation(name: string) {
            this.currentlyHighlighted = name;

            var selection = d3.selectAll(".bargroup")
                .classed("highlighted", d => d.name === this.currentlyHighlighted);

            // Bring selected node to the front:
            selection.sort((a: RentTime, b: RentTime) => a.name === name? 1 : (b.name === name? -1 : 0)); 
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

        constructor(dataset: RentTime[]) {
            this.chartWidth = $("#chart").width();

            this.xScale = ScaleBuilders.makeXScale(dataset, this.chartWidth);
            this.yScale = ScaleBuilders.makeYScale(dataset);

            AxisBuilders.makeXAxis(this.xScale);
            AxisBuilders.makeYAxis(this.yScale);
            
            this.calculateYOffsets(dataset);

            Graphics.setChartHeight(dataset);
        }

        private static setChartHeight(dataset: RentTime[]) {
            var times: number[] = dataset.map(departure => departure.time);
            var range: number = d3.max(times) - d3.min(times);

            $("#chart").height(ChartConstants.pixelsPerMinute*range);
        }

        //TODO: This is awful.
        private calculateYOffsets(dataset: RentTime[]): void {
            var sorted = dataset.sort((a, b) => a.median - b.median);

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
                x: (d: RentTime) => this.xScale(d.lowerQuartile),
                height: () => ChartConstants.pixelsPerMinute - ChartConstants.barSpacing,
                width: (d: RentTime) => this.xScale(d.upperQuartile) - this.xScale(d.lowerQuartile)
            };
        }

        public groupPositionAttrs(expandedTime: number): any {
            return {
                transform: (d: RentTime) => "translate(0," + this.yScale(this.offset(d, expandedTime)) + ")"
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
                x: () => this.chartWidth - ChartConstants.margins.right,
                y: () => ChartConstants.pixelsPerMinute - ChartConstants.barSpacing
            };
        }

        public labelText(expandedTime: number): (d: RentTime) => string {
            return (d: RentTime) => {
                if (d.time === expandedTime || (this.indices[d.name] === 0 && this.sizes[d.time] === 1)) {
                    return d.name;
                } else if (this.indices[d.name] === 0 && this.sizes[d.time] > 1) {
                    return "+";
                } else {
                    return "";
                }
            };
        }
    }

    class ScaleBuilders {

        public static makeXScale(dataset: RentTime[], chartWidth: number): D3.Scale.LinearScale {
            var lowestRent: number = d3.min(dataset, stat => stat.lowerQuartile);
            var highestRent: number = d3.max(dataset, stat => stat.upperQuartile);

            return d3.scale.linear()
                .domain([lowestRent, highestRent])
                .range([ChartConstants.margins.left, chartWidth - ChartConstants.margins.right]);
        }

        public static makeYScale(dataset: RentTime[]): D3.Scale.LinearScale {
            var times: number[] = dataset.map(departure => departure.time);
            var range: number = d3.max(times) - d3.min(times);

            return d3.scale.linear()
                .domain([0, d3.max(times)])
                .range([ChartConstants.margins.top, ChartConstants.pixelsPerMinute * range - ChartConstants.margins.bottom]);
        }
    }

    class AxisBuilders {

        public static makeXAxis(xScale: D3.Scale.LinearScale): void {
            var axis: D3.Svg.Axis = d3.svg.axis()
                .scale(xScale)
                .orient("top");

            d3.select(".x.axis")
                .attr("transform", "translate(0," + ChartConstants.xAxisOffset + ")")
                .call(axis);
        }

        public static makeYAxis(yScale: D3.Scale.LinearScale): void {
            var axis: D3.Svg.Axis = d3.svg.axis().scale(yScale).orient("left");

            d3.select(".y.axis")
                .attr("transform", "translate(" + ChartConstants.yAxisOffset + ",0)")
                .call(axis);
        }
    }

    class ChartConstants {

        public static pixelsPerMinute: number = 15;
        public static barSpacing: number = 2;

        public static margins: any = { top: 50, right: 100, bottom: 50, left: 50 };

        public static xAxisOffset: number = 40;
        public static yAxisOffset: number = 40;
    }

}
