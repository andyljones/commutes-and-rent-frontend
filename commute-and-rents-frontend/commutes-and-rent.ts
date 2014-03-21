declare var document: any;

window.onload = () => {
    var loader: CommutesAndRent.Loader = new CommutesAndRent.Loader();
};

module CommutesAndRent {

    export class Loader {

        constructor() {
            var map: MapView = new MapView();
            var chart: Chart = new Chart(() => map.getSelectedStation());
        }
    }
}

module CommutesAndRent {

    export class MapView {

        public getSelectedStation(): string { return this.selectedStation; }
        private selectedStation: string = "";

        private map: L.Map;

        private static mapTileURLTemplate: string = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        private static mapId: string = "coffeetable.hinlda0l";

        private static defaultCenter: L.LatLng = new L.LatLng(51.505, -0.09);
        private static defaultZoom: number = 13;

        constructor() {
            this.buildMap();
            this.placeStationMarkers();
        }

        private buildMap(): void 
        {
            this.map = L.map("map").setView(MapView.defaultCenter, MapView.defaultZoom);
            var tileLayer: L.TileLayer = new L.TileLayer(MapView.mapTileURLTemplate, { mapid: MapView.mapId });
            tileLayer.addTo(this.map);
        }

        private placeStationMarkers(): void
        {
            $.getJSON("preprocessor-output/processed-locations/locations.json", data => this.addStationLocations(data));
        }

        private addStationLocations(data: any): void
        {
            for (var i: number = 0; i < data.length; i++)
            {
                var name: string = data[i].name;
                var latitude: number = data[i].latitude;
                var longitude: number = data[i].longitude;

                var marker: L.Marker = L.marker(new L.LatLng(latitude, longitude), 10);
                this.map.addLayer(marker);

                (<StationMarker>marker).stationName = name;

                marker.bindPopup(name);
                marker.on("click", e => this.updateSelection(e));
            }
        }

        private updateSelection(event: L.LeafletMouseEvent): void
        {
            var marker: StationMarker = <StationMarker>event.target;
            this.selectedStation = marker.stationName;
        }
    }

    interface StationMarker extends L.Marker {
        stationName: string;
    }
}

module CommutesAndRent {

    interface RentStatistic {
        name: string;
        lowerQuartile: number;
        median: number;
        upperQuartile: number;
    }

    interface DepartureTimes {
        arrivalTime: number;
        destination: string;
        times: DepartureTime[];
    }

    interface DepartureTime {
        station: string;
        time: number;
    }

    export class Chart
    {
        private getSelectedStation: () => string;
        private rentStats: RentStatistic[];
        private departureTimes: DepartureTimes;

        private static rentStatsFolder: string = "preprocessor-output/processed-rents/";
        private static departureTimesFolder: string = "preprocessor-output/processed-departure-times/";

        private chartGraphic: D3.Selection;

        constructor(getSelectedStation: () => string)
        {
            this.getSelectedStation = getSelectedStation;
            this.initializeGraphic();

            $.when(this.loadRentData("two-bedroom-rents.json"), this.loadDepartureData("0900", "Baker Street"))
                .done(() => this.updateGraphic());
        }

        private loadRentData(filename: string): any
        {
            var filepath: string = Chart.rentStatsFolder + filename;

            return $.getJSON(filepath, (data) => { this.rentStats = data; return null; });
        }

        private loadDepartureData(time: string, stationName: string): any
        {
            var filepath: string = Chart.departureTimesFolder + time + "/" + stationName + ".json";

            return $.getJSON(filepath, (data) => { this.departureTimes = data; return null; }); 
        }

        private initializeGraphic(): void
        {
            this.chartGraphic = d3.select("#chart").append("svg").attr({ width: "100%", height: "100%", overflow: "scroll" });
        }

        private updateGraphic(): void
        {
            this.chartGraphic.selectAll("text").data(this.rentStats).enter()
                .append("text")
                .text((d) => { return d.name; })
                .attr("y", (d, i) => { return 20 * i; });

            this.chartGraphic.attr("height", this.rentStats.length * 20);
        }

        private drawRent(rentStat: RentStatistic, index: number): void
        {

        }
    }
}