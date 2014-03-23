window.onload = () => {
    var map: CommutesAndRent.Map = new CommutesAndRent.Map();
    var controller: CommutesAndRent.ChartController = new CommutesAndRent.ChartController();

    var sliders: CommutesAndRent.Sliders = new CommutesAndRent.Sliders();
    sliders.updateTimeSubscriber = time => controller.updateArrivalTime(time);
    sliders.updateBedroomSubscriber = count => controller.updateBedroomCount(count);

    map.markerSubscriber = (name: string) => controller.updateDestination(name);
};

declare function d3slider(): any;

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
                .on("slide", (event, value) => this.updateTimeSubscriber(value));

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
        public static minTime: number = 480;
        public static maxTime: number = 960;
        public static stepTime: number = 480;  

        public static minBedroom: number = 2;
        public static maxBedroom: number = 3;
        public static stepBedroom: number = 1;
    }
}

module CommutesAndRent {
    
    export class Map {

        public markerSubscriber: (name: string) => void = () => { };

        private mapObject: L.Map;

        private static mapTileURLTemplate: string = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        private static mapId: string = "coffeetable.hinlda0l";

        private static defaultCenter: L.LatLng = new L.LatLng(51.505, -0.09);
        private static defaultZoom: number = 13;

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

                new StationMarker(locations[i].name, latLng)
                    .addTo(this.mapObject)
                    .on('click', (e: L.LeafletMouseEvent) => this.markerSubscriber(e.target.name));
            }
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
        private model: ChartModel;
        private view: ChartView;

        private static defaultArrivalTime: number = 480;
        private static defaultDestination: string = "Barbican";
        private static defaultNumberOfBedrooms: number  = 2;

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
    }
}

module CommutesAndRent {

    export class ChartView {
        private model: ChartModelView;

        private svg: D3.Selection;

        private currentlyExpanded: number;

        constructor(model: ChartModelView) {
            this.model = model;
            model.updateSubscriber = () => this.update();

            this.svg = d3.select("#chart");

            this.initialize();
        }

        private initialize(): void {
            var dataset: RentTime[] = ChartView.generateDataset(this.model.rents, this.model.commutes.times);
            var graphics = new Graphics(dataset);

            this.svg.selectAll(".rent.g").data(dataset).enter()
                .append("g").attr(graphics.normalPositionAttrs());

            d3.selectAll(".rent.g")
                .append("rect").attr(graphics.rentRectAttrs())
                .on('click', d => this.expandTime(graphics, d));
        }

        private update(): void {
            var dataset: RentTime[] = ChartView.generateDataset(this.model.rents, this.model.commutes.times);
            var graphics = new Graphics(dataset);

            d3.selectAll(".rent.g").data(dataset, rentTime => rentTime.name)
                .transition()
                .attr(graphics.normalPositionAttrs());

            d3.selectAll(".rent.rect")
                .on('click', d => this.expandTime(graphics, d))
                .transition()
                .attr(graphics.rentRectAttrs());

            this.currentlyExpanded = null;
        }

        private expandTime(graphics: Graphics, d: RentTime): void {
            var data = this.svg.selectAll(".rent.g");

            if (d.time === this.currentlyExpanded) {
                data.transition().attr(graphics.normalPositionAttrs());
                this.currentlyExpanded = null;
            } else {
                data.transition().attr(graphics.expandedPositionAttrs(d.time));
                this.currentlyExpanded = d.time;
            }
        }

        private static generateDataset(rents: RentStatistic[], departures: DepartureTime[]) {
            var departureLookup: D3.Map = departures.reduce((m: D3.Map, d: DepartureTime) => { m.set(d.station, d.time); return m; }, d3.map());
            var rentTimes: RentTime[] = rents.map(rent => new RentTime(rent, departureLookup.get(rent.name)));

            return rentTimes;
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

    export class Constants {

        public static pixelsPerMinute: number = 15;
        public static barSpacing: number = 2;

        public static verticalMargin: number = 50;
        public static horizontalMargin: number = 50;

        public static xAxisOffset: number = 40;
        public static yAxisOffset: number = 40;
    }

    export class Graphics {

        private xScale: D3.Scale.LinearScale;
        private yScale: D3.Scale.LinearScale;

        private sizes: D3.Map = d3.map();
        private indices: D3.Map = d3.map();

        constructor(dataset: RentTime[]) {
            this.xScale = ScaleBuilders.makeXScale(dataset);
            this.yScale = ScaleBuilders.makeYScale(dataset);

            AxisBuilders.makeXAxis(this.xScale);
            AxisBuilders.makeYAxis(this.yScale);

            this.calculateOffsets(dataset);
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

        public rentRectAttrs(): any {
            return {
                "class": "rent rect",
                height: () => Constants.pixelsPerMinute - Constants.barSpacing,
                width: (d: RentTime) => this.xScale(d.upperQuartile) - this.xScale(d.lowerQuartile),
                opacity: 0.2
            };
        }

        public normalPositionAttrs(): any {
            return {
                transform: (d: RentTime) => "translate(" + this.xScale(d.lowerQuartile) +","+ this.yScale(d.time) + ")",
                "class": "rent g",
            };
        }

        public expandedPositionAttrs(expandedTime: number): any {
            return {
                transform: (d: RentTime) => "translate(" + this.xScale(d.lowerQuartile) + "," + this.yScale(this.offset(d, expandedTime)) + ")"
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

        public static makeXScale(dataset: RentTime[]): D3.Scale.LinearScale {
            var lowestRent: number = d3.min(dataset, stat => stat.lowerQuartile);
            var highestRent: number = d3.max(dataset, stat => stat.upperQuartile);

            return d3.scale.linear()
                .domain([lowestRent, highestRent])
                .range([Constants.horizontalMargin, $("#chart").width() - Constants.horizontalMargin]);
        }

        public static makeYScale(dataset: RentTime[]): D3.Scale.LinearScale {
            var times: number[] = dataset.map(departure => departure.time);
            var range: number = d3.max(times) - d3.min(times);

            return d3.scale.linear()
                .domain([d3.max(times), d3.min(times)])
                .range([Constants.verticalMargin, Constants.pixelsPerMinute * range - Constants.verticalMargin]);
        }
    }

    class AxisBuilders {

        public static makeXAxis(xScale: D3.Scale.LinearScale): void {
            var axis: D3.Svg.Axis = d3.svg.axis()
                .scale(xScale)
                .orient("top");

            d3.select(".x.axis")
                .attr("transform", "translate(0," + Constants.xAxisOffset + ")")
                .transition()
                .call(axis);
        }

        public static makeYAxis(yScale: D3.Scale.LinearScale): void {
            var axis: D3.Svg.Axis = d3.svg.axis().scale(yScale).orient("right");

            d3.select(".y.axis")
                .attr("transform", "translate(" + ($("#chart").width() - Constants.yAxisOffset) + ",0)")
                .transition()
                .call(axis);
        }
    }
}
