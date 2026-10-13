import { useEffect, useRef, useState } from "react";
import "../styles/SearchableDropdown.css";

function SearchableDropdown({
    label,
    value,
    options = [],
    placeholder = "Select an option",
    onChange,
    onClose,
    disabled = false,
    multiple = false,
    initialOpen = false,
    hideTrigger = false,
}) {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const [searchTerm, setSearchTerm] = useState("");

    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    const filteredOptions = options.filter((option) =>
        option.label
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
    );

    const selectedOption = multiple
        ? null
        : options.find(
              (option) => option.value === value
          );

    const selectedValues = multiple && Array.isArray(value)
        ? value
        : [];

    const selectedLabels = options
        .filter((option) =>
            selectedValues.includes(option.value)
        )
        .map((option) => option.label);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
                setSearchTerm("");
                onClose?.();
            }
        };

        document.addEventListener(
            "mousedown",
            handleClickOutside
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, [onClose]);

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    const handleToggle = () => {
        if (disabled) {
            return;
        }

        setIsOpen((previousState) => !previousState);
    };

    const handleOptionSelect = (option) => {
        if (!multiple) {
            onChange(option.value);
            setIsOpen(false);
            setSearchTerm("");

            return;
        }

        const isSelected = selectedValues.includes(option.value);

        if (isSelected) {
            onChange(
                selectedValues.filter(
                    (selectedValue) =>
                        selectedValue !== option.value
                )
            );

            return;
        }

        onChange([...selectedValues, option.value]);
    };

    return (
        <div
            ref={dropdownRef}
            className="searchable-dropdown"
        >
            <label className="searchable-dropdown-label">
                {label}
            </label>
            {!hideTrigger && (
                <button
                    type="button"
                    className="searchable-dropdown-trigger"
                    onClick={handleToggle}
                    disabled={disabled}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                >
                    <span className="searchable-dropdown-value">
                        {multiple
                            ? selectedLabels.length > 0
                                ? selectedLabels.join(", ")
                                : placeholder
                            : selectedOption?.label || placeholder}
                    </span>

                    <span
                        className="searchable-dropdown-arrow"
                        aria-hidden="true"
                    >
                        ▾
                    </span>
                </button>
            )}

            {isOpen && (
                <div className="searchable-dropdown-menu">
                    <div className="searchable-dropdown-search">
                        <input
                            ref={searchInputRef}
                            type="search"
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(event.target.value)
                            }
                            placeholder="Search..."
                            aria-label={`Search ${label}`}
                        />
                    </div>

                    <ul
                        className="searchable-dropdown-options"
                        role="listbox"
                        aria-label={label}
                        aria-multiselectable={
                            multiple
                        }
                    >
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => {
                                const isSelected = multiple
                                    ? selectedValues.includes(option.value)
                                    : option.value === value;

                                return (
                                    <li key={option.value}>
                                        <button
                                            type="button"
                                            className={`searchable-dropdown-option ${
                                                isSelected
                                                    ? "searchable-dropdown-option-active"
                                                    : ""
                                            }`}
                                            onClick={() =>
                                                handleOptionSelect(
                                                    option
                                                )
                                            }
                                            disabled={option.disabled}
                                            aria-selected={isSelected}
                                        >
                                            {multiple && (
                                                <span
                                                    className="searchable-dropdown-checkbox"
                                                    aria-hidden="true"
                                                >
                                                    {isSelected
                                                        ? "✓"
                                                        : ""}
                                                </span>
                                            )}

                                            <span>
                                                {option.label}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })
                        ) : (
                            <li className="searchable-dropdown-empty">
                                No matching options
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default SearchableDropdown;