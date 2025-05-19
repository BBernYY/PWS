# Onderzoeksvragen
CONCEPT

Hoe wordt een Physically Based Renderer op basis van Raytracing ontwikkeld?

-   Welke stappen doorloopt een lichtstraal vanaf het moment dat deze de camera verlaat tot het moment dat deze een lichtbron bereikt?
    Als eerst verwacht ik dat deze de camera uitkomt, dan zal deze reflecteren op een of meerdere objecten, waarna deze naar een lichtbron ingaat.
-   Hoe wordt een pixel op het scherm geassocieerd met een 3d-lichtstraal in een virtuele omgeving?
    Met trigonometrische functies die op basis van een (x,y)-coordinaat een lijn in vectorvoorstelling geven.
-   Hoe wordt bepaald of (en waar) een lichtstraal een bepaald object raakt?
    De positie zal gevonden worden dmv de snijdingsformule voor een vlak en een lijn.
-   Hoe wordt lichtreflectie, -absorptie en -transmissie gesimuleerd in PBR?
    Door een model toe te passen die beschrijft in welke richting licht per materiaal het meest reflecteert.
-   (Opt.) Hoe wordt de hoge rekenbelasting die raytracing heeft op de computer verminderd?
    Met o. a. een BVH, waardoor vertexintersecties verminderd kunnen worden.
# Aanpak
Eerst lees ik delen van Physically based rendering, from theory to implementation om mij te verdiepen in de algoritmen die ik zal moeten schrijven, en dan ga ik in cuda C of GLSL de raytracer zelf schrijven, meer of minder toevoegend op basis van waar tijd voor is.
Mijn onderzoek wil ik gaan schrijven in LaTeX.

