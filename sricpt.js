
// ==========================================
// SMART HOME ENERGY ANALYSIS
// ==========================================

// Global data
let energyData = [];
let consumptionChart = null;
let predictionChart = null;

// ==========================================
// SAMPLE DATA
// ==========================================

function loadSampleData() {

    energyData = [];

    const values = [
        8.2, 9.1, 7.5, 10.2, 11.4,
        8.8, 9.5, 12.1, 10.5, 8.3,
        7.8, 9.2, 11.8, 13.2, 10.4,
        9.8, 8.5, 12.4, 14.1, 11.2,
        10.8, 9.4, 13.5, 12.2, 11.7,
        8.9, 10.1, 14.5, 13.8, 12.6
    ];

    const today = new Date();

    for (let i = 29; i >= 0; i--) {

        const date = new Date(today);
        date.setDate(today.getDate() - i);

        energyData.push({
            date: date,
            consumption: values[29 - i]
        });
    }

    document.getElementById("fileName").textContent =
        "Sample electricity dataset loaded";

    document.getElementById("uploadStatus").textContent =
        "Sample dataset loaded successfully.";

    updateDashboard();
}

// ==========================================
// CSV FILE UPLOAD
// ==========================================

document.getElementById("csvFile").addEventListener("change", function(event) {

    const file = event.target.files[0];

    if (!file) return;

    document.getElementById("fileName").textContent = file.name;

    if (!file.name.toLowerCase().endsWith(".csv")) {

        document.getElementById("uploadStatus").textContent =
            "Please upload a valid CSV file.";

        return;
    }

    Papa.parse(file, {

        header: true,
        skipEmptyLines: true,

        complete: function(results) {

            try {

                const rows = results.data;

                if (!rows.length) {
                    throw new Error("CSV file is empty.");
                }

                const headers = Object.keys(rows[0]);

                const dateColumn = headers.find(h =>
                    /date|time|timestamp/i.test(h.trim())
                );

                const usageColumn = headers.find(h =>
                    /consumption|energy|usage|kwh|power/i.test(h.trim())
                );

                if (!dateColumn || !usageColumn) {

                    throw new Error(
                        "CSV must contain a date column and a consumption/kWh column."
                    );
                }

                const parsedData = rows.map(row => {

                    const date = new Date(row[dateColumn]);

                    const consumption = Number(
                        String(row[usageColumn]).replace(/,/g, "").trim()
                    );

                    if (
                        isNaN(date.getTime()) ||
                        !Number.isFinite(consumption) ||
                        consumption < 0
                    ) {
                        return null;
                    }

                    return {
                        date: date,
                        consumption: consumption
                    };

                }).filter(item => item !== null);

                if (parsedData.length === 0) {
                    throw new Error("No valid readings found in CSV.");
                }

                energyData = parsedData.sort(
                    (a, b) => a.date - b.date
                );

                document.getElementById("uploadStatus").textContent =
                    "Dataset uploaded and processed successfully! " +
                    energyData.length + " valid readings found.";

                updateDashboard();

            } catch (error) {

                document.getElementById("uploadStatus").textContent =
                    "Error: " + error.message;
            }
        },

        error: function() {

            document.getElementById("uploadStatus").textContent =
                "Unable to read CSV file.";
        }
    });

});

// ==========================================
// SAMPLE DATA BUTTON
// ==========================================

document.getElementById("sampleBtn").addEventListener("click", function() {
    loadSampleData();
});

// ==========================================
// BASIC STATISTICS
// ==========================================

function getAverage(values) {

    if (!values.length) return 0;

    return values.reduce((a, b) => a + b, 0) / values.length;
}

function getTotal(values) {

    return values.reduce((a, b) => a + b, 0);
}

function getPercentile(values, percentile) {

    if (!values.length) return 0;

    const sorted = [...values].sort((a, b) => a - b);

    const position = (sorted.length - 1) * percentile;

    const lower = Math.floor(position);
    const upper = Math.ceil(position);

    if (lower === upper) return sorted[lower];

    return sorted[lower] +
        (sorted[upper] - sorted[lower]) * (position - lower);
}

function formatNumber(value) {
    return Number(value).toFixed(2);
}

// ==========================================
// ENERGY CLASSIFICATION
// ==========================================

function classifyEnergy(value, readings) {

    const lowLimit = getPercentile(readings, 0.33);
    const highLimit = getPercentile(readings, 0.67);

    if (value <= lowLimit) {
        return "Low";
    }

    if (value <= highLimit) {
        return "Medium";
    }

    return "High";
}

// ==========================================
// GROUP DATA BY DATE
// ==========================================

function getDailyData() {

    const dailyMap = {};

    energyData.forEach(item => {

        const key = item.date.getFullYear() + "-" +
            String(item.date.getMonth() + 1).padStart(2, "0") + "-" +
            String(item.date.getDate()).padStart(2, "0");

        dailyMap[key] = (dailyMap[key] || 0) + item.consumption;

    });

    return Object.entries(dailyMap)
        .map(([date, consumption]) => ({
            date: date,
            consumption: consumption
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

// ==========================================
// WEEKLY DATA
// ==========================================

function getWeeklyData(dailyData) {

    const weeklyMap = {};

    dailyData.forEach(item => {

        const date = new Date(item.date + "T12:00:00");

        const day = date.getDay();

        date.setDate(date.getDate() - day);

        const key = date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0") + "-" +
            String(date.getDate()).padStart(2, "0");

        weeklyMap[key] = (weeklyMap[key] || 0) + item.consumption;

    });

    return Object.entries(weeklyMap).map(([date, consumption]) => ({
        date: date,
        consumption: consumption
    }));
}

// ==========================================
// MONTHLY DATA
// ==========================================

function getMonthlyData(dailyData) {

    const monthlyMap = {};

    dailyData.forEach(item => {

        const key = item.date.substring(0, 7);

        monthlyMap[key] = (monthlyMap[key] || 0) + item.consumption;

    });

    return Object.entries(monthlyMap).map(([date, consumption]) => ({
        date: date,
        consumption: consumption
    }));
}

// ==========================================
// UPDATE DASHBOARD
// ==========================================

function updateDashboard() {

    if (!energyData.length) return;

    const total = getTotal(
        energyData.map(item => item.consumption)
    );

    const dailyData = getDailyData();

    const dailyValues = dailyData.map(item => item.consumption);

    const averageDaily = getAverage(dailyValues);

    const category = classifyEnergy(
        averageDaily,
        dailyValues
    );

    const predictions = generatePrediction(dailyData);

    document.getElementById("totalConsumption").textContent =
        formatNumber(total) + " kWh";

    document.getElementById("averageConsumption").textContent =
        formatNumber(averageDaily) + " kWh";

    document.getElementById("energyCategory").textContent =
        category;

    document.getElementById("predictedConsumption").textContent =
        formatNumber(predictions.monthly) + " kWh";

    document.getElementById("classificationResult").textContent =
        category;

    const descriptions = {
        Low: "Your household electricity consumption is relatively low. Keep maintaining these energy-efficient habits.",
        Medium: "Your household has moderate electricity consumption. Consider improving energy efficiency.",
        High: "Your household electricity consumption is high. Review appliance usage and reduce unnecessary electricity consumption."
    };

    document.getElementById("classificationDescription").textContent =
        descriptions[category];

    document.getElementById("weeklyPrediction").textContent =
        formatNumber(predictions.weekly) + " kWh";

    document.getElementById("monthlyPrediction").textContent =
        formatNumber(predictions.monthly) + " kWh";

    updateConsumptionChart();

    updatePredictionChart(predictions);

    updateRecommendations(category, averageDaily);
}

// ==========================================
// CONSUMPTION CHART
// ==========================================

function updateConsumptionChart() {

    const filter = document.getElementById("chartFilter").value;

    const dailyData = getDailyData();

    let chartData = dailyData;

    if (filter === "weekly") {
        chartData = getWeeklyData(dailyData);
    }

    if (filter === "monthly") {
        chartData = getMonthlyData(dailyData);
    }

    const labels = chartData.map(item => item.date);

    const values = chartData.map(item =>
        Number(item.consumption.toFixed(2))
    );

    const ctx = document.getElementById("consumptionChart");

    if (consumptionChart) {
        consumptionChart.destroy();
    }

    consumptionChart = new Chart(ctx, {

        type: "line",

        data: {

            labels: labels,

            datasets: [{

                label: "Electricity Consumption (kWh)",

                data: values,

                borderColor: "#18a66d",

                backgroundColor: "rgba(24,166,109,0.12)",

                fill: true,

                tension: 0.35,

                borderWidth: 3,

                pointRadius: 3,

                pointBackgroundColor: "#18a66d"
            }]
        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            interaction: {
                intersect: false,
                mode: "index"
            },

            plugins: {

                legend: {
                    display: false
                }
            },

            scales: {

                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Consumption (kWh)"
                    }
                },

                x: {
                    ticks: {
                        maxTicksLimit: 10
                    }
                }
            }
        }
    });
}

// ==========================================
// FUTURE CONSUMPTION PREDICTION
// ==========================================

function generatePrediction(dailyData) {

    const values = dailyData.map(item => item.consumption);

    // Use the average of the latest seven days
    const recentValues = values.slice(-7);

    const average = getAverage(recentValues);

    // Estimate the trend from recent daily readings
    const firstHalf = recentValues.slice(
        0,
        Math.ceil(recentValues.length / 2)
    );

    const secondHalf = recentValues.slice(
        Math.floor(recentValues.length / 2)
    );

    const trend = getAverage(secondHalf) - getAverage(firstHalf);

    // Limit trend adjustment to avoid extreme estimates
    const adjustment = Math.max(
        -average * 0.10,
        Math.min(average * 0.10, trend * 0.25)
    );

    const predictedDaily = Math.max(0, average + adjustment);

    return {

        daily: predictedDaily,

        weekly: predictedDaily * 7,

        monthly: predictedDaily * 30
    };
}

// ==========================================
// PREDICTION CHART
// ==========================================

function updatePredictionChart(predictions) {

    const dailyData = getDailyData();

    const recent = dailyData.slice(-14);

    const labels = recent.map(item => item.date);

    const actualValues = recent.map(item => item.consumption);

    const predictedValues = Array(14).fill(null);

    // Connect forecast to the final historical value
    if (actualValues.length) {
        predictedValues[predictedValues.length - 1] =
            actualValues[actualValues.length - 1];
    }

    const lastDate = dailyData.length
        ? new Date(dailyData[dailyData.length - 1].date + "T12:00:00")
        : new Date();

    for (let i = 1; i <= 7; i++) {

        const nextDate = new Date(lastDate);

        nextDate.setDate(lastDate.getDate() + i);

        const label = nextDate.getFullYear() + "-" +
            String(nextDate.getMonth() + 1).padStart(2, "0") + "-" +
            String(nextDate.getDate()).padStart(2, "0");

        labels.push(label);

        actualValues.push(null);

        predictedValues.push(
            Number(predictions.daily.toFixed(2))
        );
    }

    const ctx = document.getElementById("predictionChart");

    if (predictionChart) {
        predictionChart.destroy();
    }

    predictionChart = new Chart(ctx, {

        type: "line",

        data: {

            labels: labels,

            datasets: [

                {
                    label: "Historical Consumption",

                    data: actualValues,

                    borderColor: "#18a66d",

                    backgroundColor: "rgba(24,166,109,0.10)",

                    borderWidth: 3,

                    tension: 0.3,

                    spanGaps: false
                },

                {
                    label: "Predicted Consumption",

                    data: predictedValues,

                    borderColor: "#9673e5",

                    backgroundColor: "rgba(150,115,229,0.10)",

                    borderWidth: 3,

                    borderDash: [6, 5],

                    pointRadius: 3,

                    tension: 0.3,

                    spanGaps: false
                }

            ]
        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {
                    position: "bottom"
                }
            },

            scales: {

                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Consumption (kWh)"
                    }
                },

                x: {
                    ticks: {
                        maxTicksLimit: 10
                    }
                }
            }
        }
    });
}

// ==========================================
// ENERGY RECOMMENDATIONS
// ==========================================

function updateRecommendations(category, average) {

    const container = document.getElementById("recommendationList");

    let recommendations = [];

    if (category === "High") {

        recommendations = [

            {
                icon: "❄️",
                title: "Optimise Air Conditioner",
                description: "Avoid unnecessary AC usage and maintain an efficient temperature setting."
            },

            {
                icon: "🔌",
                title: "Reduce Standby Power",
                description: "Switch off unused appliances and unplug devices when possible."
            },

            {
                icon: "💡",
                title: "Use Energy Efficient Lighting",
                description: "Replace conventional bulbs with LED lighting to reduce electricity usage."
            }
        ];

    } else if (category === "Medium") {

        recommendations = [

            {
                icon: "🌞",
                title: "Use Natural Lighting",
                description: "Use daylight whenever possible to reduce lighting electricity consumption."
            },

            {
                icon: "⚡",
                title: "Monitor Daily Usage",
                description: "Check daily electricity readings to identify unnecessary consumption."
            },

            {
                icon: "🔌",
                title: "Switch Off Devices",
                description: "Turn off electrical devices when they are not being used."
            }
        ];

    } else {

        recommendations = [

            {
                icon: "🌱",
                title: "Maintain Good Habits",
                description: "Continue following your energy-efficient household practices."
            },

            {
                icon: "💡",
                title: "Use LED Lighting",
                description: "Choose energy-efficient lighting to save additional electricity."
            },

            {
                icon: "☀️",
                title: "Explore Solar Energy",
                description: "Consider solar energy as an alternative source of electricity."
            }
        ];
    }

    container.innerHTML = recommendations.map(item => `

        <div class="recommendation">

            <span>${item.icon}</span>

            <h3>${item.title}</h3>

            <p>${item.description}</p>

        </div>

    `).join("");
}

// ==========================================
// CHART FILTER
// ==========================================

document.getElementById("chartFilter").addEventListener("change", function() {

    if (energyData.length) {
        updateConsumptionChart();
    }

});

// ==========================================
// NAVIGATION ACTIVE STATE
// ==========================================

document.querySelectorAll(".nav-link").forEach(link => {

    link.addEventListener("click", function() {

        document.querySelectorAll(".nav-link").forEach(item => {
            item.classList.remove("active");
        });

        this.classList.add("active");

    });

});

// ==========================================
// INITIALISE WEBSITE
// ==========================================

document.addEventListener("DOMContentLoaded", function() {

    loadSampleData();

    console.log("EcoSmart Energy Dashboard Started Successfully!");

});
