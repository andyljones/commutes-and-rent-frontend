window.onload = () => {
    new CommutesAndRent.Map();
    new CommutesAndRent.ChartController();

}


module CommutesAndRent {
    
    export class Map {

        private mapObject: L.Map;

        private static mapTileURLTemplate: string = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        private static mapId: string = "coffeetable.hinlda0l";

        private static defaultCenter: L.LatLng = new L.LatLng(51.505, -0.09);
        private static defaultZoom: number = 13;

        private static locationDataPath: string = "preprocessor-output/processed-locations/locations.json";

        constructor() {

            this.mapObject = Map.buildMap();

            $.getJSON(Map.locationDataPath, (data) => Map.addMarkers(this.mapObject, data));
        }

        private static buildMap(): L.Map {

            var map: L.Map = L.map("map").setView(Map.defaultCenter, Map.defaultZoom);

            new L.TileLayer(Map.mapTileURLTemplate, { mapid: Map.mapId }).addTo(map);

            return map;
        }

        private static addMarkers(map: L.Map, locations: Location[]): void
        {
            locations.forEach(loc => this.addMarker(map, loc));
        }

        private static addMarker(map: L.Map, location: Location): void
        {
            var latLng: L.LatLng = new L.LatLng(location.latitude, location.longitude);

            new L.Marker(latLng).addTo(map);
        }
    }

    interface Location {

        name: string;
        longitude: number;
        latitude: number;        
    }
}

module CommutesAndRent
{
    export class ChartModel {

        public rents: RentStatistic[];
        public arrivalTimes: number[];
        
        private static rentStatsFolder: string = "preprocessor-output/processed-rents/";
        private static departureTimesFolder: string = "preprocessor-output/processed-departure-times/";

        constructor(successContinuation: (model: ChartModel) => void) {

            $.when(this.loadRentData("two-bedroom-rents.json"), this.loadTimesData())
                .then(() => successContinuation(this));
        }
        
        public getDepartureData(time: number, stationName: string): JQueryXHR {

            var filepath: string = ChartModel.departureTimesFolder + time + "/" + stationName + ".json";

            return $.getJSON(filepath);
        }

        private loadRentData(filename: string): JQueryXHR {

            var filepath: string = ChartModel.rentStatsFolder + filename;

            return $.getJSON(filepath, (data) => { this.rents = data; return null; });
        }


        private loadTimesData(): JQueryXHR {

            var filepath: string = ChartModel.departureTimesFolder + "times.json";

            return $.getJSON(filepath, (data) => { this.arrivalTimes = data; return null; });
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

        constructor()
        {
            new ChartModel(this.initializeController);
        }

        private initializeController(model: ChartModel): void {

            this.model = model;
            this.view = new ChartView(model.rents);

            model.getDepartureData(ChartController.defaultArrivalTime, ChartController.defaultDestination)
                .then((data) => this.view.setDepartureData(data));
        }


    }
}

module CommutesAndRent {

    export class ChartView {

        private rentStats: RentStatistic[];
        private departures: DepartureTimes;

        private chartHeight: number;
        private chartWidth: number;

        private static barSpacing: number = 1;

        constructor(rentStats: RentStatistic[]) {

            this.rentStats = rentStats;

            this.chartHeight = $("#chart").height();
            this.chartWidth = $("#chart").width();
        }

        public setDepartureData(data: DepartureTimes): void {

            this.departures = data;
            this.updateGraphic();
        }

        private updateGraphic(): void {

            var xScale: D3.Scale.LinearScale = this.createXScale();
            var yScale: D3.Scale.LinearScale = this.createYScale();

            d3.select("#chart").selectAll("rect").data(this.rentStats).enter()
                .append("rect")
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