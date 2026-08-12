"""MVP simulation assumptions shared by data generation and online inference.

These values are not learned model coefficients and must not be presented as such.
The dispatch curve is the same designed mechanism used by ai/generate_data.py::tdisp.
The operating-cost values are demo assumptions; replace them with versioned market or
fleet configuration before production use.
"""

DISPATCH_CURVE_SCALE = 266.0
DISPATCH_CURVE_EXPONENT = 0.354

FUEL_EFFICIENCY_KM_PER_LITER = {5: 4.3, 11: 3.2, 25: 2.4}
FUEL_PRICE_KRW_PER_LITER = 1_650
EMPTY_COST_KRW_PER_KM = {5: 850, 11: 1_050, 25: 1_350}
