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

        constructor(model: ChartModelView) {
            this.model = model;
            model.updateSubscriber = () => this.updateChart();

            this.svg = d3.select("#chart");

            this.chartWidth = $("#chart").width();

            this.updateChart();
        }

        private updateChart(): void {
            var graphics = new Graphics(this.model.rents, this.model.commutes.times);

            var data: D3.UpdateSelection = this.svg.selectAll("rect").data(this.generateData(), rentTime => rentTime.name);
            data.attr(graphics.rentRectAttrs);

            data.enter().append("rect").attr(graphics.rentRectAttrs);
        }

        private generateData() {
            var departureLookup: D3.Map = this.model.commutes.times.reduce((m: D3.Map, d: DepartureTime) => { m.set(d.station, d.time); return m; }, d3.map());
            var rentTimes: RentTime[] = this.model.rents.map(rent => new RentTime(rent, departureLookup.get(rent.name)));

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

        public rentRectAttrs: any = {
            x: (d: RentTime) => this.xScale(d.lowerQuartile),
            y: (d: RentTime) => this.yScale(d.time),
            height: 10,
            width: (d: RentTime) => this.xScale(d.upperQuartile) - this.xScale(d.lowerQuartile)
        };

        private xScale: D3.Scale.LinearScale;
        private yScale: D3.Scale.LinearScale;

        private static pixelsPerMinute = 10;

        constructor(rentStats: RentStatistic[], departures: DepartureTime[]) {
            this.xScale = this.makeXScale(rentStats);
            this.yScale = this.makeYScale(departures);
        }

        private makeXScale(rentStats: RentStatistic[]): D3.Scale.LinearScale {
            var lowestRent: number = d3.min(rentStats, stat => stat.lowerQuartile);
            var highestRent: number = d3.max(rentStats, stat => stat.upperQuartile);

            return d3.scale.linear()
                .domain([lowestRent, highestRent])
                .range([0, $("#chart").width()]);
        }

        private makeYScale(departures: DepartureTime[]): D3.Scale.LinearScale {
            var times: number[] = departures.map(departure => departure.time);
            var range: number = d3.max(times) - d3.min(times);

            return d3.scale.linear()
                .domain([d3.max(times), d3.min(times)])
                .range([0, Graphics.pixelsPerMinute * range]);
        }
    }
}
