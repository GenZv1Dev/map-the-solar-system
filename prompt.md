on page load, fetch the data/dataset.csv, parse it into a json object and store it in indexed db, so that in the next load it will load faster, add a loader, lucide react, use tailwind to make a new design, install three js, load the textures for the earth and moon, create a realistic solar system, for the planets that don't have textures use their colors and the moon textures for example mars can use the moon textures and be red, make sure the scene is high quality, good shadows good lighting, realistic sun, you can look at the example I've attached it has all of that, we need fly camera that lets you fly anywhere when you left click or right click it hides the mouse and let you use wasd to fly and shift to fly faster, we need astreoids belts, a black hole in the center, labels above each area of the universe, for example label for earth, the sun, mars, the kepler belt, the black hole, milkey way, andromada, for those things just make a giant knot or something, make something good, make it shiny, if you want I also attached some background scifi ambient sounds you can use, the solar system and the planets needs to have their rings and they need to travel along them, and each planet needs to have all their moon, realistic rings around satrun, and so on, each thing with a label that you can click, a ui on the left that lets you scroll through all the interest point and click them and it takes you there, and now starts the fun part, the ultimate goal of this is to map realistially to the best of our ability all the 958k astreoids in the solar system in their fixed position in space at the time the dataset was taken, then you can estimate based on the albedo the materials, and combine that with the size of the astroids and you can estimate it's value, now each astreoids needs to be categorized, lazy loading search with pagination, total value statistics, a single astreoid can be worth 10 trillion dollars, make nice fonts for the money, cool animations for the ui, the goal is to make a full on asreoids marketplace but also render all the rocks of the asreoids in their size, shine level and etc, give them labels, a value, how hard is it gonna be to mine them, and anything else that I forgot that you can bring over from the data, I attached an example data so you won't have to read dataset.csv, this file is 138mb do not read it.

id,spkid,full_name,pdes,name,prefix,neo,pha,H,diameter,albedo,diameter_sigma,orbit_id,epoch,epoch_mjd,epoch_cal,equinox,e,a,q,i,om,w,ma,ad,n,tp,tp_cal,per,per_y,moid,moid_ld,sigma_e,sigma_a,sigma_q,sigma_i,sigma_om,sigma_w,sigma_ma,sigma_ad,sigma_n,sigma_tp,sigma_per,class,rms
a0000001,2000001,"     1 Ceres",1,Ceres,,N,N,3.4,939.4,0.090,0.2,"JPL 47",2458600.5,58600,20190427.0000000,J2000,.0760090265983052,2.769165148633284,2.558683601195717,10.59406719506626,80.30553090445737,73.59769469844186,77.37209751948711,2.979646696070851,.2138852265918273,2458238.754129317955,20180430.2541293,1683.145702657688,4.60820178687936,1.59478,620.6405326,4.819E-12,1.0328E-11,1.9569E-11,4.6089E-9,6.1688E-8,6.6248E-8,7.8207E-9,1.1113E-11,1.1965E-12,3.7829E-8,9.4159E-9,MBA,.43301
a0000002,2000002,"     2 Pallas",2,Pallas,,N,N,4.2,545,0.101,18,"JPL 37",2459000.5,59000,20200531.0000000,J2000,.2299722588646258,2.773841434873298,2.135934854363191,34.83293159121413,173.0247412488342,310.2023924446679,144.9756754788195,3.411748015383405,.213344586343708,2458320.962365774508,20180721.4623658,1687.410991624711,4.61987951163507,1.23429,480.3486393,3.1934E-8,4.0337E-9,8.8322E-8,3.4694E-6,6.2724E-6,9.1282E-6,8.8591E-6,4.9613E-9,4.6536E-10,4.0787E-5,3.6807E-6,MBA,.35936
a0000003,2000003,"     3 Juno",3,Juno,,N,N,5.33,246.596,0.214,10.594,"JPL 112",2459000.5,59000,20200531.0000000,J2000,.2569364345017789,2.66828528813587,1.982705579968687,12.99104349619575,169.8514824901798,248.0661932666256,125.4353546073513,3.353864996303052,.2261286975791392,2458445.792190021781,20181123.2921900,1592.01376850459,4.35869614922543,1.03429,402.5146393,3.052E-8,3.4718E-9,8.1392E-8,3.2231E-6,1.6646E-5,1.7721E-5,8.1104E-6,4.3639E-9,4.4134E-10,3.5288E-5,3.1072E-6,MBA,.33848


Basic Column Definition
SPK-ID: Object primary SPK-ID
Object ID: Object internal database ID
Object fullname: Object full name/designation
pdes: Object primary designation
name: Object IAU name
NEO: Near-Earth Object (NEO) flag
PHA: Potentially Hazardous Asteroid (PHA) flag
H: Absolute magnitude parameter
Diameter: object diameter (from equivalent sphere) km Unit
Albedo: Geometric albedo
Diameter_sigma: 1-sigma uncertainty in object diameter km Unit
Orbit_id: Orbit solution ID
Epoch: Epoch of osculation in modified Julian day form
Equinox: Equinox of reference frame
e: Eccentricity
a: Semi-major axis au Unit
q: perihelion distance au Unit
i: inclination; angle with respect to x-y ecliptic plane
tp: Time of perihelion passage TDB Unit
moid_ld: Earth Minimum Orbit Intersection Distance au Unit

https://www.kaggle.com/datasets/sakhawat18/asteroid-dataset?resource=download

1) when I refresh it says "Loaded 958,524 asteroids from cache"
and gets stuck on it is it possible to make a progress bar for this stage
2) the textures of the earth aren't working well like the old project and the moon too, it use to load all kinds of textures I want them all look at the old-project
3) my camera moves too fast, I want that the longer you hold shift the faster you become
4) and I want a slider to set the solar system spin speed
5) add realistic sun magenetic circle things

there is not enough light coming out of the sun and all the planets are spinning too fast, the original example was trying to make them spin fast but you need to change it back to normal speed, and get the blackhole outside the solar system it needs to be really far away from it, and bigger

the black hole is in the solar system not good I meant that it needs to be in the center of what looks like the milky way, and the planets aren't visible, can't see any planet even when I pick it, the astreoids needs to be a little more shiny or with outline if they are near you or something or labels or something but only the close ones to you, and the solar system planets are spinning too fast, make it normal speed

still, undo whatever you just did it didn't do anything, you need to add a little bit of delay after the download finish so it can reach width 100% currently it gets stuck on like 86% width I see in the dev tools

same issue

still when it reaches 100% in the ui it looks like 98% its not full

when the progress bar reach 100% it's not full all the way through

still gets stuck on 99% before you load it update it for 1 frame

errors

it lies on the amount of mb it downloads and gets stuck on 99% of the progressbar looks like 70 instead of updating to loading or something when it loads before storing starts, also:


[vite:css][postcss] @import must precede all other statements (besides @charset or empty @layer)
1234 |    animation: slide-up 0.3s ease-out;
1235 |  }
1236 |  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;6...
     |  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
1237 |  .font-mono {
1238 |    font-family: 'JetBrains Mono', monospace;

removing the strict mode is incorrect, you need to fix it in another way

the app is already running, we got 1 error, when I refresh it downloads the dataset.csv twice because of the strict mode

the label ui is updating incorrectly, use 3d text instead so it wont delay until the label shows up in there, we need the label above the planet itself and make it face the camera and have the color of the planet and outline and very clear from any distance it should scale but not distract

when I reload before finishing to store all astreoids it starts to store again instead of continuing from where it finished which causes the indexed db to bloat with MB

I can see a weird shadow around the earth and barely can see it's textures of the day but the night textures doesn't show at all, look again at the old project it worked perfectly there... we messed up something with the shadow

also please put a little more effort to the sun:

The sun, a sphere of hot plasma, presents several distinct visual elements that can be observed, primarily within its atmosphere. 
Layers of the Solar Atmosphere
Photosphere: This is the visible "surface" of the sun, which appears as a bright, glowing white disk when viewed from space. When observed with telescopes, it has a mottled, granular texture (like boiling water) caused by upwelling and sinking convection currents of hot gas, a phenomenon called granulation. The edge of the solar disk appears dimmer than the center, known as limb darkening, due to temperature variations.
Chromosphere: This layer sits above the photosphere and is generally not visible because the photosphere is so much brighter. During a total solar eclipse, it appears briefly as a thin, reddish ring or glow. It gets its color from emitting light in the red part of the visible spectrum.
Corona: The outermost layer of the sun's atmosphere, the corona is an expansive, extremely hot, and very faint halo of plasma that extends millions of kilometers into space. It is also primarily visible only during a total solar eclipse, appearing as a spiky, white, crown-like structure. It is not uniform and exhibits features like loops, plumes, and dark areas called coronal holes. 
Dynamic Features
Visible features on and around the sun's atmosphere include:
Sunspots: These appear as temporary, dark, cooler regions on the photosphere. They typically occur in groups and are caused by intense magnetic activity that inhibits the convection of heat to the surface.
Solar Flares: These are sudden, intense eruptions of electromagnetic radiation and charged particles from the sun's atmosphere, often associated with sunspots.
Prominences/Filaments: These are large, bright features made of dense, cool plasma extending outward from the sun's surface, often in loop shapes, guided by magnetic field lines. When viewed against the bright solar disk, they appear dark and are called filaments.
Spicules: These are dynamic, short-lived jets of plasma that shoot upward from the chromosphere, lasting only a few minutes.
Coronal Mass Ejections (CMEs): While not a constant visual element, these are massive clouds or streams of charged particles ejected into space from the corona, often following solar flares or prominence eruptions.
Solar Wind: This is a constant flow of charged particles streaming from the corona, particularly from coronal holes. It is generally invisible but its interaction with Earth's magnetic field creates the visible auroras (Northern and Southern Lights) in the night sky.

we got some errors, and look I cleaned up index.js please make sure the earth and moon are like this they work perfectly here

for some reason there's only 1000 astreoids in the ui search instead of the 900k+
the sun light is too bright*
mercury is glitching through the sun and doesn't have an orbit
the kuplier belt is missing the a vast, doughnut-shaped region of icy bodies and dwarf planets
pluto is missing
add smoke and gas giants and saturn rings and all the moons
mars moons are spinning too fast
mars is missing the textures we said to use the moon see prompt.md for the full original plan
make it by default spin not paused, but not in real time, very slow, and when you focus a planet set the focus mode and make it track it and the camera face the planet you chosen, also I can't see the black hole from a distance