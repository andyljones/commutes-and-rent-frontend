window.onload = () => {
    var map: CommutesAndRent.Map = new CommutesAndRent.Map();
    var controller: CommutesAndRent.ChartController = new CommutesAndRent.ChartController();

    map.markerSubscriber = (name: string) => controller.updateDestination(name);
}


module CommutesAndRent {
    
    export class Map {

        public markerSubscriber: (name: string) => void;

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
    export class ChartModel {

        public rents: RentStatistic[];
        public arrivalTimes: number[];
        public departureTimes: DepartureTimes;
        
        private static rentStatsFolder: string = "preprocessor-output/processed-rents/";
        private static departureTimesFolder: string = "preprocessor-output/processed-departure-times/";

        public inititalize(): Q.Promise<void[]> {
            return Q.all([this.loadTimesData()]);
        }
        
        public loadDepartureData(time: number, stationName: string): Q.Promise<void> {
            var filepath: string = ChartModel.departureTimesFolder + time + "/" + stationName + ".json";

            return Q($.getJSON(filepath)).then(data => { this.departureTimes = data; return null; });
        }

        public loadRentData(filename: string): Q.Promise<void> {
            var filepath: string = ChartModel.rentStatsFolder + filename;

            return Q($.getJSON(filepath)).then(data => { this.rents = data; return null; });
        }


        private loadTimesData(): Q.Promise<void> {
            var filepath: string = ChartModel.departureTimesFolder + "times.json";

            return Q($.getJSON(filepath)).then(data => { this.arrivalTimes = data; return null; });
        }
    }

    export interface RentStatistic {
        name: string;
        lowerQuartile: number;
        median: number;
        upperQuartile: number;
    }

    export interface DepartureTimes {
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

    export class ChartController
    {
        private model: ChartModel;
        private view: ChartView;

        private static defaultArrivalTime: number = 480;
        private static defaultDestination: string = "Barbican";
        private static defaultRentFile: string = "two-bedroom-rents.json";

        private currentArrivalTime: number;
        private currentDestination: string;

        constructor() { 
            this.model = new ChartModel();
            this.model.inititalize()
                .then(() => Q.all([
                    this.model.loadRentData(ChartController.defaultRentFile),
                    this.model.loadDepartureData(ChartController.defaultArrivalTime, ChartController.defaultDestination)
                ]))
                .then(() => this.initializeController());
        }

        private initializeController(): void {
            this.view = new ChartView(this.model.rents);

            this.currentArrivalTime = ChartController.defaultArrivalTime;
            this.currentDestination = ChartController.defaultDestination;

            this.updateView();
        }

        public updateDestination(stationName: string) {
            this.currentDestination = stationName;
            this.updateView();
        }

        private updateView() {
            this.model.loadDepartureData(this.currentArrivalTime, this.currentDestination)
                .then(() => this.view.setDepartureData(this.model.departureTimes));
        }
    }
}

module CommutesAndRent {

    export class ChartView {

        private rentStats: RentStatistic[];
        private departures: DepartureTimes;

        private rects: D3.Selection;

        private chartHeight: number;
        private chartWidth: number;

        private static barSpacing: number = 1;

        constructor(rentStats: RentStatistic[]) {
            this.rentStats = rentStats;

            this.chartHeight = $("#chart").height();
            this.chartWidth = $("#chart").width();

            this.rects = ChartView.createGraphic(rentStats);
        }

        private static createGraphic(rentStats: RentStatistic[]): D3.Selection {
            return d3.select("#chart").selectAll("*").data(rentStats).enter().append("rect");
        }

        public setDepartureData(data: DepartureTimes): void {
            this.departures = data;
            this.updateGraphic();
        }

        private updateGraphic(): void {
            var xScale: D3.Scale.LinearScale = this.createXScale();
            var yScale: D3.Scale.LinearScale = this.createYScale();

            this.rects.data(this.rentStats)
                .attr(this.rentRectAttrs(xScale, yScale));
        }

        private createXScale(): D3.Scale.LinearScale {
            var result: D3.Scale.LinearScale = d3.scale.linear()
                .domain([d3.min(this.rentStats, d => d.lowerQuartile), d3.max(this.rentStats, d => d.upperQuartile)])
                .range([0, this.chartWidth])
                .nice();

            return result;
        }

        private createYScale(): D3.Scale.LinearScale {
            var result: D3.Scale.LinearScale = d3.scale.linear()
                .domain([0, this.departures.arrivalTime - d3.min(this.departures.times, d => d.time)])
                .range([0, this.chartHeight])
                .nice();

            return result;
        }

        private rentRectAttrs(xScale: D3.Scale.LinearScale, yScale: D3.Scale.LinearScale): any {
            var departureTimeLookup: any = {};
            this.departures.times.forEach(d => departureTimeLookup[d.station] = d.time);

            var result: any = {
                x: (d, i) => xScale(d.lowerQuartile),
                y: (d, i) => yScale(this.departures.arrivalTime - departureTimeLookup[d.name]),
                height: () => yScale(1) - yScale(0) - ChartView.barSpacing,
                width: d => xScale(d.upperQuartile) - xScale(d.lowerQuartile),
                opacity: 0.2
            };

            return result;
        }
    }
}