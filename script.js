const width = 960;
const height = 600;
const margin = { top: 20, right: 30, bottom: 30, left: 40 };

const projection = d3.geoMercator()
    .center([0, 20])
    .scale(150)
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

const svg = d3.select("#map").attr("width", width).attr("height", height);
const g = svg.append("g");

const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", event => g.attr("transform", event.transform));

svg.call(zoom);

let deathData;
let selectedDrug = "Death: Opioid use disorders";

// Load death data
d3.json("deathDrug.json").then(data => {
    deathData = data;
    updateMap(2000);
}).catch(error => console.error("Error loading deathDrug.json:", error));

// Load world countries data
d3.json("world-countries.json").then(worldData => {
    const countries = worldData.features;

    g.selectAll("path")
        .data(countries)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", d => getColor(getCountryName(d), 2000))
        .attr("stroke", "white")
        .on("click", clicked);

    g.selectAll("text")
        .data(countries)
        .enter().append("text")
        .attr("transform", d => `translate(${path.centroid(d)})`)
        .attr("dy", ".35em")
        .attr("class", "country-label")
        .text(d => getCountryName(d))
        .attr("font-size", "6px")
        .attr("text-anchor", "middle");

    createLegend();
}).catch(error => console.error("Error loading world-countries.json:", error));

d3.select("#yearSlider").on("input", function() {
    const year = +this.value;
    updateMap(year);
});

d3.select("#drugSelect").on("change", function() {
    selectedDrug = this.value;
    updateMap(+document.getElementById("yearSlider").value);
});

// Change drug type
function changeDrug(drug) {
    selectedDrug = drug;
    updateMap(+document.getElementById("yearSlider").value);
}

function getCountryName(d) {
    return d && d.properties && d.properties.name ? d.properties.name : "Unknown";
}

const color = d3.scaleQuantize()
    .domain([0, 500])
    .range(["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"]);

function getColor(country, year) {
    if (!deathData || country === "Unknown") return "#ccc";
    const countryData = deathData.filter(d => d.Entity === country && d.Year === year);
    if (countryData.length === 0) return "#ccc";
    const totalDeaths = countryData[0][selectedDrug] || 0;
    return color(totalDeaths);
}

function updateMap(year) {
    console.log("Updating map for year:", year);
    d3.selectAll("path").attr("fill", d => getColor(getCountryName(d), year));
    d3.select("#yearLabel").text(`Year: ${year}`);
    updateMinMaxChart(year);
}

function clicked(event, d) {
    console.log("Clicked on country:", getCountryName(d));
    const country = getCountryName(d);
    const countryData = deathData.filter(data => data.Entity === country);
    if (countryData.length === 0) return;

    d3.select("#chart").html("");
    d3.select("#barChart").html("");

    createLineChart(countryData, country);
    const minDeath = d3.min(countryData, d => d[selectedDrug]);
    const maxDeath = d3.max(countryData, d => d[selectedDrug]);
    createBarChart(minDeath, maxDeath, country);
}

function createLineChart(data, country) {
    const chartWidth = 400 - margin.left - margin.right;
    const chartHeight = 200 - margin.top - margin.bottom;

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.Year))
        .range([0, chartWidth]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d[selectedDrug])])
        .nice()
        .range([chartHeight, 0]);

    const line = d3.line()
        .x(d => x(d.Year))
        .y(d => y(d[selectedDrug]));

    const svgChart = d3.select("#chart").append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    svgChart.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr("d", line);

    svgChart.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svgChart.append("g")
        .call(d3.axisLeft(y));

    const minDeath = d3.min(data, d => d[selectedDrug]);
    const maxDeath = d3.max(data, d => d[selectedDrug]);

    svgChart.append("rect")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight / 2)
        .attr("width", 100)
        .attr("height", 50)
        .attr("fill", "white")
        .attr("stroke", "black");

    svgChart.append("text")
        .attr("x", chartWidth / 2 + 10)
        .attr("y", chartHeight / 2 + 20)
        .text(country);

    svgChart.append("text")
        .attr("x", chartWidth / 2 + 10)
        .attr("y", chartHeight / 2 + 35)
        .text("Max Death: " + maxDeath);

    svgChart.append("text")
        .attr("x", chartWidth / 2 + 10)
        .attr("y", chartHeight / 2 + 50)
        .text("Min Death: " + minDeath);
}

function createBarChart(minDeath, maxDeath, country) {
    d3.select("#barChart").html("");

    const barChartWidth = 400 - margin.left - margin.right;
    const barChartHeight = 200 - margin.top - margin.bottom;

    const svgBarChart = d3.select("#barChart").append("svg")
        .attr("width", barChartWidth + margin.left + margin.right)
        .attr("height", barChartHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(["Min Death", "Max Death"])
        .range([0, barChartWidth])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max([minDeath, maxDeath])])
        .nice()
        .range([barChartHeight, 0]);

    svgBarChart.append("g")
        .attr("transform", `translate(0,${barChartHeight})`)
        .call(d3.axisBottom(x));

    svgBarChart.append("g").call(d3.axisLeft(y));

    svgBarChart.selectAll(".bar")
        .data([{ key: "Min Death", value: minDeath }, { key: "Max Death", value: maxDeath }])
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.key))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", d => barChartHeight - y(d.value))
        .attr("fill", "steelblue");

    svgBarChart.append("text")
        .attr("x", barChartWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(`Drug-Related Deaths in ${country}`);
}

function updateMinMaxChart(year) {
    const yearData = deathData.filter(d => d.Year === year && d.Entity !== "World" && !isContinent(d.Entity));
    if (yearData.length === 0) return;

    const minDeathCountry = d3.min(yearData, d => d[selectedDrug]);
    const maxDeathCountry = d3.max(yearData, d => d[selectedDrug]);

    const minCountry = yearData.find(d => d[selectedDrug] === minDeathCountry).Entity;
    const maxCountry = yearData.find(d => d[selectedDrug] === maxDeathCountry).Entity;

    d3.select("#minMaxChart").html(`
        <p>In ${year}, the country with the lowest death rate was ${minCountry} with ${minDeathCountry} deaths.</p>
        <p>In ${year}, the country with the highest death rate was ${maxCountry} with ${maxDeathCountry} deaths.</p>
    `);
}

function isContinent(entity) {
    const continents = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];
    return continents.includes(entity);
}

function createLegend() {
    const legendWidth = 300;
    const legendHeight = 10;

    const legendSvg = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - legendWidth - 20},${height - 40})`);

    const legend = legendSvg.selectAll(".legend")
        .data(color.range().map(d => color.invertExtent(d)))
        .enter().append("g")
        .attr("class", "legend-item");

    legend.append("rect")
        .attr("x", (d, i) => i * (legendWidth / color.range().length))
        .attr("y", 0)
        .attr("width", legendWidth / color.range().length)
        .attr("height", legendHeight)
        .style("fill", d => color(d[0]));

    legend.append("text")
        .attr("class", "legend-label")
        .attr("x", (d, i) => i * (legendWidth / color.range().length) + (legendWidth / color.range().length) / 2)
        .attr("y", legendHeight + 10)
        .attr("dy", ".35em")
        .style("text-anchor", "middle")
        .text(d => Math.round(d[0]));

    legendSvg.append("text")
        .attr("class", "legend-title")
        .attr("x", 0)
        .attr("y", -10)
        .style("text-anchor", "start")
        .text("Drug-related Deaths");
}

