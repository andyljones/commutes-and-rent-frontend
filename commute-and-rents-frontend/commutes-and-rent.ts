window.onload = () => {
    var map: CommutesAndRent.Map = new CommutesAndRent.Map();
    var controller: CommutesAndRent.ChartController = new CommutesAndRent.ChartController();

    var sliders: CommutesAndRent.Sliders = new CommutesAndRent.Sliders();
    sliders.updateTimeSubscriber = time => controller.updateArrivalTime(time);
    sliders.updateBedroomSubscriber = count => controller.updateBedroomCount(count);

    map.clickListener = (name: string) => controller.updateDestination(name);
    map.mouseoverListener = (name: string) => controller.highlight(name);

    controller.mouseoverListener = (name: string) => map.highlightMarker(name);
};

declare function d3slider(): any;

declare module L {
    export var AwesomeMarkers: any;
}

module CommutesAndRent {
        
    export class Sliders {
        public updateTimeSubscriber: (number) => void = () => { };
        public updateBedroomSubscriber: (number) => void = () => { };

        private static departureTimesFolder: string = "preprocessor-output/processed-departure-times/";

        //TODO: Defaults are currently in the controller.
        constructor() {
            this.makeTimeSlider();
            this.makeBedroomCountSlider();
        }

        private makeTimeSlider() {
            var slider: any = d3slider()
                .axis(true)
                .min(SliderConstants.minTime).max(SliderConstants.maxTime).step(SliderConstants.stepTime)
                .on("slide", (event, value) => this.updateTimeSubscriber(SliderConstants.hoursToMinutes(value)));

            d3.select("#timeslider").call(slider);
        }

        private makeBedroomCountSlider() {
            var slider: any = d3slider()
                .axis(true)
                .min(SliderConstants.minBedroom).max(SliderConstants.maxBedroom).step(SliderConstants.stepBedroom)
                .on("slide", (event, value) => this.updateBedroomSubscriber(value));

            d3.select("#bedroomslider").call(slider);
        }

    }

    class SliderConstants {
        public static minTime: number = 7;
        public static maxTime: number = 24;
        public static stepTime: number = 1;
        public static hoursToMinutes: (number) => number = n => 60 * (n - 1);

        public static minBedroom: number = 1;
        public static maxBedroom: number = 4;
        public static stepBedroom: number = 1;
    }
}

module CommutesAndRent {
    
    export class Map {

        public clickListener: (name: string) => void = () => { };
        public mouseoverListener: (name: string) => void = () => { };

        private markerLookup: D3.Map = d3.map();
        private currentlyHighlightedMarker: L.Marker = null;
        
        private mapObject: L.Map;

        private static mapTileURLTemplate: string = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        private static mapId: string = "coffeetable.hinlda0l";

        private static defaultCenter: L.LatLng = new L.LatLng(51.505, -0.09);
        private static defaultZoom: number = 13;

        private static normalMarker = L.AwesomeMarkers.icon({ markerColor: 'blue' });
        private static highlightMarker = L.AwesomeMarkers.icon({ markerColor: 'orange' });

        private static locationDataPath: string = "preprocessor-output/processed-locations/locations.json";

        constructor() {

            this.mapObject = Map.buildMap();

            Q($.getJSON(Map.locationDataPath)).then(data => this.addMarkers(data));
        }

        private static buildMap(): L.Map {

            var map: L.Map = L.map("map").setView(Map.defaultCenter, Map.defaultZoom);

            new L.TileLayer(Map.mapTileURLTemplate, { mapid: Map.mapId }).addTo(map);

            return map;
        }

        private addMarkers(locations: Location[]): void
        {
            for (var i: number = 0; i < locations.length; i++)
            {
                var latLng: L.LatLng = new L.LatLng(locations[i].latitude, locations[i].longitude);

                var marker: L.Marker = new StationMarker(locations[i].name, latLng, { icon: Map.normalMarker })
                    .addTo(this.mapObject)
                    .on("click", (e: L.LeafletMouseEvent) => this.clickListener(e.target.name))
                    .on("mouseover", (e: L.LeafletMouseEvent) => this.notifyAndHighlight(e.target.name));

                this.markerLookup.set(locations[i].name, marker);
            }
        }

        private notifyAndHighlight(name: string): void {
            this.mouseoverListener(name);
            this.highlightMarker(name);
        }

        public highlightMarker(name: string): void {

            if (this.currentlyHighlightedMarker !== null) {
                this.currentlyHighlightedMarker.setIcon(Map.normalMarker);
            }

            var marker = this.markerLookup.get(name);
            marker.setIcon(Map.highlightMarker);

            this.currentlyHighlightedMarker = marker;
        }
    }

    interface Location {

        name: string;
        longitude: number;
        latitude: number;        
    }

    export class StationMarker extends L.Marker {

        public name: string;

        constructor(name: string, latLng: L.LatLng, options?: any) {
            super(latLng, options);

            this.name = name;
        }
    }
}

module CommutesAndRent
{
    export class ChartModel implements ChartModelView {

        public updateSubscriber: () => void = () => { };

        public rents: RentStatistic[];
        public commutes: CommuteTimes;
        
        private static rentStatsFolder: string = "preprocessor-output/processed-rents/";
        private static departureTimesFolder: string = "preprocessor-output/processed-departure-times/";

        public loadCommuteData(time: number, stationName: string): Q.Promise<void> {
            var filepath: string = ChartModel.departureTimesFolder + time + "/" + stationName + ".json";

            return Q($.getJSON(filepath)).then(data => { this.commutes = data; this.updateSubscriber(); return null; });
        }

        public loadRentData(numberOfBedrooms: number): Q.Promise<void> {
            var filepath: string = ChartModel.rentStatsFolder + numberOfBedrooms + "-bedroom-rents.json";

            return Q($.getJSON(filepath)).then(data => { this.rents = data; this.updateSubscriber(); return null; });
        }
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

    export interface ChartModelView {
        rents: RentStatistic[];
        commutes: CommuteTimes;
        updateSubscriber: () => void;
    }
}

module CommutesAndRent {

    export class ChartController
    {
        public mouseoverListener: (name: string) => void = () => { };

        private model: ChartModel;
        private view: ChartView;

        private static defaultArrivalTime: number = 480;
        private static defaultDestination: string = "Barbican";
        private static defaultNumberOfBedrooms: number  = 1;

        constructor() { 
            this.model = new ChartModel();
            Q.all([
                    this.model.loadRentData(ChartController.defaultNumberOfBedrooms),
                    this.model.loadCommuteData(ChartController.defaultArrivalTime, ChartController.defaultDestination)
                ])
            .then(() => this.initialize());
        }

        private initialize(): void {
            this.view = new ChartView(this.model);
            d3.selectAll(".rent.rect").on("mouseover", d => this.notifyAndHighlight(d.name));
        }

        public updateBedroomCount(bedroomCount: number) {
            this.model.loadRentData(bedroomCount);
        }

        public updateArrivalTime(arrivalTime: number) {
            this.model.loadCommuteData(arrivalTime, this.model.commutes.destination);
        }

        public updateDestination(stationName: string) {
            this.model.loadCommuteData(this.model.commutes.arrivalTime, stationName);
        }

        private notifyAndHighlight(name: string) {
            this.mouseoverListener(name);
            this.highlight(name);
        }

        public highlight(name: string) {
            this.view.highlightStation(name);
        }
    }
}

module CommutesAndRent {

    export class ChartView {
        private model: ChartModelView;

        private svg: D3.Selection;

        private graphics: Graphics;

        private currentlyExpanded: number;
        private currentlyHighlighted: string;

        constructor(model: ChartModelView) {
            this.model = model;
            model.updateSubscriber = () => this.update();

            this.svg = d3.select("#chart");

            this.initialize();
        }

        private initialize(): void {
            var dataset: RentTime[] = ChartView.generateDataset(this.model.rents, this.model.commutes.times);
            this.graphics = new Graphics(dataset);

            var selection = this.svg.selectAll(".rent.g").data(dataset).enter()
                .append("g")
                .attr(this.graphics.normalPositionAttrs());

            selection
                .append("rect")
                .attr(this.graphics.barAttrs(this.currentlyHighlighted))
                .on('click', d => this.expandTime(d.time));

            selection
                .append("text")
                .attr(this.graphics.normalLabelAttrs())
                .text(this.graphics.normalLabelText());
        }

        private update(): void {
            var dataset: RentTime[] = ChartView.generateDataset(this.model.rents, this.model.commutes.times);
            this.graphics = new Graphics(dataset);

            var selection = d3.selectAll(".rent.g").data(dataset, rentTime => rentTime.name);

            selection
                .transition()
                .attr(this.graphics.normalPositionAttrs());

            selection.select(".rent.rect")
                .on('click', d => this.expandTime(d.time))
                .transition()
                .attr(this.graphics.barAttrs(this.currentlyHighlighted));

            selection.select(".rent.text")
                .transition()
                .attr(this.graphics.normalLabelAttrs())
                .text(this.graphics.normalLabelText());

            this.currentlyExpanded = null;
        }

        private expandTime(time: number): void {
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
        }

        private static generateDataset(rents: RentStatistic[], departures: DepartureTime[]) {
            var departureLookup: D3.Map = departures.reduce((m: D3.Map, d: DepartureTime) => { m.set(d.station, d.time); return m; }, d3.map());
            var rentTimes: RentTime[] = rents.map(rent => new RentTime(rent, departureLookup.get(rent.name)));

            return rentTimes;
        }

        public highlightStation(name: string) {
            this.currentlyHighlighted = name;

            d3.selectAll(".rent.rect")
                .attr(this.graphics.barAttrs(this.currentlyHighlighted));
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
}

module CommutesAndRent {

    export class ChartConstants {

        public static pixelsPerMinute: number = 15;
        public static barSpacing: number = 2;

        public static margins: any = { top: 50, right: 100, bottom: 50, left: 50 };

        public static xAxisOffset: number = 40;
        public static yAxisOffset: number = 40;
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

            this.calculateOffsets(dataset);

            Graphics.setChartHeight(dataset);
        }

        private static setChartHeight(dataset: RentTime[]) {
            var times: number[] = dataset.map(departure => departure.time);
            var range: number = d3.max(times) - d3.min(times);

            $("#chart").height(ChartConstants.pixelsPerMinute*range);
        }

        private calculateOffsets(dataset: RentTime[]): void {
            for (var i: number = 0; i < dataset.length; i++) {

                var count = this.sizes[dataset[i].time];

                if (typeof count === "number") {
                    this.indices[dataset[i].name] = count;
                    this.sizes[dataset[i].time] = count + 1;
                } else {
                    this.indices[dataset[i].name] = 0;
                    this.sizes[dataset[i].time] = 1;
                }
            }
        }

        public barAttrs(highlighted: string): any {
            return {
                "class": "rent rect",
                x: (d: RentTime) => this.xScale(d.lowerQuartile),
                height: () => ChartConstants.pixelsPerMinute - ChartConstants.barSpacing,
                width: (d: RentTime) => this.xScale(d.upperQuartile) - this.xScale(d.lowerQuartile),
                fill: d => d.name === highlighted? "orange" : "blue",
                opacity: d => d.name === highlighted? 1 : 0.2
            };
        }

        public normalPositionAttrs(): any {
            return {
                transform: (d: RentTime) => "translate(0,"+ this.yScale(d.time) + ")",
                "class": "rent g",
            };
        }

        public expandedPositionAttrs(expandedTime: number): any {
            return {
                transform: (d: RentTime) => "translate(0," + this.yScale(this.offset(d, expandedTime)) + ")"
            };
        }

        public normalLabelAttrs(): any {
            return {
                "class": "rent text",
                x: () => this.chartWidth - ChartConstants.margins.right,
                y: () => ChartConstants.pixelsPerMinute
            };
        }

        public expandedLabelText(expandedTime: number): any {
            return d => {
                if (d.time === expandedTime || (this.indices[d.name] === 0 && this.sizes[d.time] === 1)) {
                    return d.name;
                } else if (this.indices[d.name] === 0 && this.sizes[d.time] > 1) {
                    return "+";
                } else {
                    return "";
                }
            };
        }
                
        public normalLabelText(): any {
            return d => {
                if (this.indices[d.name] === 0 && this.sizes[d.time] === 1) {
                    return d.name;
                } else if (this.indices[d.name] === 0 && this.sizes[d.time] > 1) {
                    return "+";
                } else {
                    return "";
                }
            };
        }

        private offset(d: RentTime, expandedTime: number): number {
            if (d.time < expandedTime) {
                return d.time - (this.sizes[expandedTime] - 1);
            }
            else if (d.time === expandedTime) {
                return d.time - this.indices[d.name];
            }
            else {
                return d.time;
            }
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
                .domain([d3.max(times), d3.min(times)])
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
                .transition()
                .call(axis);
        }

        public static makeYAxis(yScale: D3.Scale.LinearScale): void {
            var axis: D3.Svg.Axis = d3.svg.axis().scale(yScale).orient("left");

            d3.select(".y.axis")
                .attr("transform", "translate(" + ChartConstants.yAxisOffset + ",0)")
                .transition()
                .call(axis);
        }
    }
}
