// COMMONS — the shared MapLibre base map.
//
// A thin wrapper over react-map-gl/maplibre that paints the CSP-clean CARTO dark
// raster basemap centred on HSR Layout. Both the 3D twin and the 2D choropleth
// render their layers on top of this. Children are map sources/layers/markers.
import { useRef } from "react";
import Map, { type MapRef } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { CARTO_DARK_STYLE, WARD_CENTER } from "../../lib/twinGeo.ts";
import type { ReactNode } from "react";

interface Props {
  children?: ReactNode;
  pitch?: number;
  bearing?: number;
  interactive?: boolean;
  onLoad?: (map: maplibregl.Map) => void;
}

export function BaseMap({ children, pitch = 0, bearing = 0, interactive = true, onLoad }: Props) {
  const ref = useRef<MapRef | null>(null);
  return (
    <Map
      ref={ref}
      mapLib={maplibregl}
      initialViewState={{
        longitude: WARD_CENTER.lng,
        latitude: WARD_CENTER.lat,
        zoom: 13.4,
        pitch,
        bearing,
      }}
      // The inlined CARTO raster style — no token, no external style.json fetch.
      mapStyle={CARTO_DARK_STYLE as maplibregl.StyleSpecification}
      interactive={interactive}
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
      onLoad={(e) => onLoad?.(e.target)}
    >
      {children}
    </Map>
  );
}
