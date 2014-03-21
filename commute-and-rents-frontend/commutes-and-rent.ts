window.onload = () => {
    var loader: CommutesAndRent.Loader = new CommutesAndRent.Loader();
};

module CommutesAndRent {
    declare var document: any;

    export class Loader {

        constructor() {
            var map: MapView = new MapView();
        }
    }

    class MapView {
        private map: L.Map;

        private static mapTileURLTemplate: string = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        private static mapId: string = "coffeetable.hinlda0l";

        private static defaultCenter: L.LatLng = new L.LatLng(51.505, -0.09);
        private static defaultZoom: number = 13;

        constructor() {
            this.buildMap();
        }

        private buildMap(): void 
        {
            this.map = L.map("map").setView(MapView.defaultCenter, MapView.defaultZoom);

            var tileLayer: L.TileLayer = new L.TileLayer(MapView.mapTileURLTemplate, { mapid: MapView.mapId });
            tileLayer.addTo(this.map);
        }
    }
}