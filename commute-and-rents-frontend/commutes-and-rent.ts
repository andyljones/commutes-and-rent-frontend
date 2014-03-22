window.onload = () => {
    var map: CommutesAndRent.Map = new CommutesAndRent.Map();
    var controller: CommutesAndRent.ChartController = new CommutesAndRent.ChartController();

    map.markerSubscriber = (name: string) => controller.updateDestination(name);
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
        public arrivalTimes: number[];
        public commutes: CommuteTimes;
        
        private static rentStatsFolder: string = "preprocessor-output/processed-rents/";
        private static departureTimesFolder: string = "preprocessor-output/processed-departure-times/";

        public initialize(): Q.Promise<void[]> {
            return Q.all([this.loadTimesData()]);
        }
        
        private loadTimesData(): Q.Promise<void> {
            var filepath: string = ChartModel.departureTimesFolder + "times.json";

            return Q($.getJSON(filepath)).then(data => { this.arrivalTimes = data; this.updateSubscriber(); return null; });
        }

        public loadCommuteData(time: number, stationName: string): Q.Promise<void> {
            var filepath: string = ChartModel.departureTimesFolder + time + "/" + stationName + ".json";

            return Q($.getJSON(filepath)).then(data => { this.commutes = data; this.updateSubscriber(); return null; });
        }

        public loadRentData(filename: string): Q.Promise<void> {
            var filepath: string = ChartModel.rentStatsFolder + filename;

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
        arrivalTimes: number[];
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
        private static defaultRentFile: string = "two-bedroom-rents.json";

        constructor() { 
            this.model = new ChartModel();
            this.model.initialize()
                .then(() => Q.all([
                    this.model.loadRentData(ChartController.defaultRentFile),
                    this.model.loadCommuteData(ChartController.defaultArrivalTime, ChartController.defaultDestination)
                ]))
                .then(() => this.initialize());
        }

        private initialize(): void {
            this.view = new ChartView(this.model);
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

        private chartWidth: number;

        private currentlyExpanded: number;

        constructor(model: ChartModelView) {
            this.model = model;
            model.updateSubscriber = () => this.updateChart();

            this.svg = d3.select("#chart");

            this.chartWidth = $("#chart").width();

            this.updateChart();
        }

        private updateChart(): void {
            var dataset: RentTime[] = ChartView.generateDataset(this.model.rents, this.model.commutes.times);
            var graphics = new Graphics(dataset);

            var selection: D3.UpdateSelection = this.svg.selectAll("rect").data(dataset, rentTime => rentTime.name)

            selection.on('click', d => this.expandTime(selection, graphics, d))
                .transition().attr(graphics.normalRentAttrs());

            selection.enter().append("rect").attr(graphics.normalRentAttrs())
                .on('click', d => this.expandTime(selection, graphics, d));
        }

        private expandTime(data: D3.UpdateSelection, graphics: Graphics, d: RentTime): void {
            if (d.time === this.currentlyExpanded) {
                data.transition().attr(graphics.normalRentAttrs());
                this.currentlyExpanded = null;
            } else {
                data.transition().attr(graphics.expandedRentAttrs(d.time));
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

    export class Graphics {

        private xScale: D3.Scale.LinearScale;
        private yScale: D3.Scale.LinearScale;

        private static pixelsPerMinute = 10;

        private sizes: D3.Map = d3.map();
        private indices: D3.Map = d3.map();

        constructor(dataset: RentTime[]) {
            this.xScale = this.makeXScale(dataset);
            this.yScale = this.makeYScale(dataset);

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

        private makeXScale(dataset: RentTime[]): D3.Scale.LinearScale {
            var lowestRent: number = d3.min(dataset, stat => stat.lowerQuartile);
            var highestRent: number = d3.max(dataset, stat => stat.upperQuartile);

            return d3.scale.linear()
                .domain([lowestRent, highestRent])
                .range([0, $("#chart").width()]);
        }

        private makeYScale(dataset: RentTime[]): D3.Scale.LinearScale {
            var times: number[] = dataset.map(departure => departure.time);
            var range: number = d3.max(times) - d3.min(times);

            return d3.scale.linear()
                .domain([d3.max(times), d3.min(times)])
                .range([0, Graphics.pixelsPerMinute*range]);
        }

        public normalRentAttrs(): any {
            return {
                x: (d: RentTime) => this.xScale(d.lowerQuartile),
                y: (d: RentTime) => this.yScale(d.time),
                height: 10,
                width: (d: RentTime) => this.xScale(d.upperQuartile) - this.xScale(d.lowerQuartile),
                opacity: 0.2
            };
        }

        public expandedRentAttrs(expandedTime: number): any {
            return {
                y: (d: RentTime) => this.yScale(this.offset(d, expandedTime))
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
}
