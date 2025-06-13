# Formula Test Document

This document demonstrates LaTeX formula support in the markdown to PDF converter.

## Inline Formulas

Here are some inline formulas: The famous equation $E = mc^2$ shows the relationship between energy and mass. The quadratic formula is $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$.

## Display Formulas

### Basic Math

The fundamental theorem of calculus:

$$
\frac{d}{dx}\left( \int_{0}^{x} f(u)\,du\right)=f(x)
$$

### Complex Equations

Maxwell's equations in differential form:

$$
\begin{align}
\nabla \cdot \mathbf{E} &= \frac{\rho}{\epsilon_0} \\
\nabla \cdot \mathbf{B} &= 0 \\
\nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\
\nabla \times \mathbf{B} &= \mu_0\left(\mathbf{J} + \epsilon_0 \frac{\partial \mathbf{E}}{\partial t}\right)
\end{align}
$$

### Matrices and Vectors

Matrix multiplication:

$$
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}
=
\begin{bmatrix}
ax + by \\
cx + dy
\end{bmatrix}
$$

### Integrals and Summations

The Fourier transform:

$$
\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x) e^{-2\pi i x \xi} dx
$$

Geometric series:

$$
\sum_{n=0}^{\infty} ar^n = \frac{a}{1-r} \quad \text{for } |r| < 1
$$

## Mixed Content

You can mix formulas with regular text seamlessly. For example, the probability density function of a normal distribution is $f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{1}{2}\left(\frac{x-\mu}{\sigma}\right)^2}$, and its cumulative distribution function involves the error function.

The standard normal distribution has the beautiful property:

$$
\int_{-\infty}^{\infty} \frac{1}{\sqrt{2\pi}} e^{-\frac{x^2}{2}} dx = 1
$$

This ensures that the total probability equals 1, as expected for any probability distribution. 