const width = 1200;
const height = 800;
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
let intervalId;
let isPlaying = false;

// Load death data
d3.json("deathDrug.json").then(data => {
    deathData = data;
    updateMap(2000);
}).catch(error => console.error("Error loading deathDrug.json:", error));


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
        .text("")
        .attr("font-size", "6px")
        .attr("text-anchor", "middle")
        .style("pointer-events", "none");

    g.selectAll("path")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke-width", 2);
            g.selectAll(".country-label")
                .filter(l => l.properties.name === d.properties.name)
                .text(d.properties.name)
                .style("fill", "gray")
                .attr("background", "white");
        })
        .on("mouseout", function(event, d) {
            d3.select(this).attr("stroke-width", 1);
            g.selectAll(".country-label")
                .filter(l => l.properties.name === d.properties.name)
                .text("");
        });

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


const playPauseButton = d3.select("#playPauseButton");
playPauseButton.on("click", function() {
    if (isPlaying) {
        clearInterval(intervalId);
        playPauseButton.text("Play");
    } else {
        intervalId = setInterval(() => {
            let currentYear = +document.getElementById("yearSlider").value;
            currentYear = currentYear < 2019 ? currentYear + 1 : 2000;
            document.getElementById("yearSlider").value = currentYear;
            updateMap(currentYear);
        }, 1000);
        playPauseButton.text("Pause");
    }
    isPlaying = !isPlaying;
});

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
    d3.selectAll("path")
        .transition()
        .duration(500)
        .attr("fill", d => getColor(getCountryName(d), year));
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
    const minYear = countryData.find(d => d[selectedDrug] === minDeath).Year;
    const maxYear = countryData.find(d => d[selectedDrug] === maxDeath).Year;
    createBarChart([{ year: minYear, death: minDeath }, { year: maxYear, death: maxDeath }]);
}

function createLineChart(data, country) {
    const chartWidth = 400 ;
    const chartHeight = 200 ;

    d3.select("#chart").append("div")
    .attr("class", "country-title")
    .style("text-align", "center")
    .style("margin-bottom", "10px")
    .text(country);

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

    const svg = d3.select("#chart").append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    svg.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.append("g")
        .call(d3.axisLeft(y));

    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr("d", line)
        .attr("stroke-dasharray", function() { return this.getTotalLength(); })
        .attr("stroke-dashoffset", function() { return this.getTotalLength(); })
        .transition()
        .duration(2000)
        .attr("stroke-dashoffset", 0);

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    svg.selectAll("circle")
        .data(data)
        .enter().append("circle")
        .attr("cx", d => x(d.Year))
        .attr("cy", d => y(d[selectedDrug]))
        .attr("r", 3)
        .attr("fill", "steelblue")
        .on("mouseover", function(event, d) {
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`Year: ${d.Year}<br/>Deaths: ${d[selectedDrug]}`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition().duration(500).style("opacity", 0);
        });
}

function createBarChart(data) {
    const barChartWidth = 400; 
    const barChartHeight = 200; 

    const svgBarChart = d3.select("#barChart").append("svg")
        .attr("width", barChartWidth + margin.left + margin.right)
        .attr("height", barChartHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(data.map(d => d.year))
        .range([0, barChartWidth])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.death)]).nice()
        .range([barChartHeight, 0]);

    svgBarChart.append("g")
        .attr("transform", `translate(0,${barChartHeight})`)
        .call(d3.axisBottom(x));

    svgBarChart.append("g")
        .call(d3.axisLeft(y));

    svgBarChart.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.year))
        .attr("y", barChartHeight) 
        .attr("width", x.bandwidth())
        .attr("height", 0)  
        .attr("fill", "orange")
        .transition()
        .duration(2000)
        .attr("y", d => y(d.death))
        .attr("height", d => barChartHeight - y(d.death));

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    svgBarChart.selectAll(".bar")
        .on("mouseover", function(event, d) {
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`Year: ${d.year}<br/>Deaths: ${d.death}`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition().duration(500).style("opacity", 0);
        });
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
