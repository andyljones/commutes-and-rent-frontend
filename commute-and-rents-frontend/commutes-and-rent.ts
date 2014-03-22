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

        private rects: D3.Selection;

        private chartHeight: number;
        private chartWidth: number;

        private static barSpacing: number = 1;
        private static barHeight: number = 10;

        constructor(model: ChartModelView) {
            this.model = model;
            model.updateSubscriber = () => this.updateChart();

            this.chartHeight = $("#chart").height();
            this.chartWidth = $("#chart").width();
        }

        private updateChart(): void {
            console.log(this.model.commutes.destination);
        }
    }
}