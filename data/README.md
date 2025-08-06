# Data Directory

This directory contains CSV files and other data assets for the application.

## Airport Data

Place your `airports.csv` file here with the following structure:
- Column A: IATA code (3-letter airport codes like SYD, LAX, etc.)
- Column C: Airport Name (e.g., "Kingsford Smith International Airport")
- Column E: City (e.g., "Sydney")

### File Location
```
/data/airports.csv
```

### Usage
The CSV file will be read by the application to populate airport search functionality and generate flight URLs.

### Format Expected
```csv
IATA,B,Airport Name,D,City,F,G...
SYD,,Kingsford Smith International Airport,,Sydney,,
LAX,,Los Angeles International Airport,,Los Angeles,,
```

Note: Columns B, D, F, G, etc. can contain any data and will be ignored by the parser.
