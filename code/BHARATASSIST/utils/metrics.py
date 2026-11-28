import statistics


def calculate_average(values):
    if not values:
        return 0
    return round(statistics.mean(values), 3)


def calculate_median(values):
    if not values:
        return 0
    return round(statistics.median(values), 3)


def calculate_grounded_rate(values):
    if not values:
        return 0
    return round(sum(values) / len(values) * 100, 2)
