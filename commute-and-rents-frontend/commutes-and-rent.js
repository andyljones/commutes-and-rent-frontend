window.onload = function () {
    var loader = new CommutesAndRent.Loader();
};

var CommutesAndRent;
(function (CommutesAndRent) {
    var Loader = (function () {
        function Loader() {
            var map = new MapView();
        }
        return Loader;
    })();
    CommutesAndRent.Loader = Loader;

    var MapView = (function () {
        function MapView() {
            this.buildMap();
        }
        MapView.prototype.buildMap = function () {
            this.map = L.map("map").setView(MapView.defaultCenter, MapView.defaultZoom);

            var tileLayer = new L.TileLayer(MapView.mapTileURLTemplate, { mapid: MapView.mapId });
            tileLayer.addTo(this.map);
        };
        MapView.mapTileURLTemplate = "http://api.tiles.mapbox.com/v3/{mapid}/{z}/{x}/{y}.png";
        MapView.mapId = "coffeetable.hinlda0l";

        MapView.defaultCenter = new L.LatLng(51.505, -0.09);
        MapView.defaultZoom = 13;
        return MapView;
    })();
})(CommutesAndRent || (CommutesAndRent = {}));
//# sourceMappingURL=commutes-and-rent.js.map
