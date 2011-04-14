function normal_random(mean, dev) {
  with (Math) {
    var a = random();
    var b = random();
    return dev * sqrt(-2 * log(a)) * sin(2 * PI * b) + mean;
  }
}

module.exports = normal_random;
