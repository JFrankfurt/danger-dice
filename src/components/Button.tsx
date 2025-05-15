import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "small" | "medium" | "large";
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  size = "medium",
  className = "",
  type = "button",
  ...props
}) => {
  const baseStyle =
    "font-bold rounded-lg shadow-md hover:shadow-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-50";

  const variantStyles = {
    primary:
      "bg-indigo-500 hover:bg-indigo-600 text-white focus:ring-indigo-400",
    secondary: "bg-gray-500 hover:bg-gray-600 text-white focus:ring-gray-400",
    danger: "bg-red-500 hover:bg-red-600 text-white focus:ring-red-400",
    ghost:
      "bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-300 border border-gray-300 hover:border-gray-400",
  };

  const sizeStyles = {
    small: "py-2 px-3 text-sm",
    medium: "py-3 px-6 text-base",
    large: "py-4 px-8 text-lg",
  };

  const disabledStyle = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseStyle}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${disabledStyle}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
