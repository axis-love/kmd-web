# Math Expressions

## Inline math

The equation $E = mc^2$ is famous.

Inline math with LaTeX: $\frac{a}{b}$ and $\sum_{i=1}^{n} x_i$.

## Block math (display)

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$

$$
\begin{aligned}
f(x) &= (x+a)(x+b) \\
     &= x^2 + (a+b)x + ab
\end{aligned}
$$

## Mixed inline and block

The formula $x^2 + y^2 = z^2$ describes a circle.

$$
\left( \sum_{k=1}^n a_k b_k \right)^2 \leq \left( \sum_{k=1}^n a_k^2 \right) \left( \sum_{k=1}^n b_k^2 \right)
$$

## Math with special symbols

$\forall \epsilon > 0, \exists \delta > 0$ such that $|f(x) - L| < \epsilon$.

## Pathological math input

$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$

## Math in code block (should NOT render as math)

```text
$E = mc^2$ is in a code block
```

## Math in inline code (should NOT render as math)

Use `$x$` to denote a variable.