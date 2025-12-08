export const restaurantKB = {
    name: "The Himalayan House",
  
    address: {
      full: "123 Mountain View Ave, New York, NY",
      street: "123 Mountain View Ave",
      city: "New York",
      borough: "Brooklyn",
      zip: "11201",
    },
  
    contact: {
      phone: "(212) 555-9823",
      email: "contact@himalayanhouse.com"
    },
  
    hours: {
      weekday: "11:00 AM – 10:00 PM",
      weekend: "11:00 AM – 11:00 PM",
      open_full:
        "We are open Sunday–Thursday from 11:00 AM to 10:00 PM, and Friday–Saturday from 11:00 AM to 11:00 PM."
    },
  
    policies: {
      refund:
        "All food sales are final once served. If there is an issue with your order, please speak to a staff member during your visit.",
      reservation:
        "We accept reservations for parties of four or more. Walk-ins are welcome for smaller groups.",
      cancellation:
        "For reservations of eight or more, please notify us 24 hours in advance to cancel or modify.",
      delivery:
        "We offer takeout and pickup only. We do not provide third-party delivery.",
      online_order:
        "Online ordering is available for pickup only."
    },
  
    restaurant_facts: {
      founded: "2016",
      history:
        "The Himalayan House was founded in 2016 by Chef Dorje Lama, inspired by his upbringing in Pokhara, Nepal. The restaurant began as a small food stall in Jackson Heights before expanding into a full dining establishment.",
      owner: "Dorje Lama",
      seating_capacity: 50,
      employees: 14
    },
  
    chefs: [
      {
        name: "Dorje Lama",
        title: "Head Chef & Owner",
        specialties: ["Himalayan Curry", "Momo Variations", "Dal Bhat"],
        years_experience: 18
      },
      {
        name: "Mira Shrestha",
        title: "Sous Chef",
        specialties: ["Noodle Soups", "Vegetarian Dishes"],
        years_experience: 9
      }
    ],
  
    menu: {
      momos: {
        name: "Momos",
        description:
          "Traditional Nepali dumplings served steamed or fried.",
        ingredients: [
          "wheat flour wrapper",
          "garlic",
          "ginger",
          "scallions",
          "cilantro"
        ],
        fillings: {
          chicken: ["ground chicken", "ginger", "garlic", "onion", "spices"],
          beef: ["ground beef", "garlic", "ginger", "onion"],
          vegetable: ["cabbage", "carrot", "onion", "garlic", "ginger"]
        },
        price: 12,
        vegetarian: false,
        vegan: false,
        gluten_free: false,
        contains_nuts: false,
        spice_level: "mild"
      },
  
      chow_mein: {
        name: "Chow Mein",
        description:
          "Nepali-style stir fried noodles with vegetables and optional protein.",
        ingredients: [
          "wheat noodles",
          "cabbage",
          "bell peppers",
          "onion",
          "soy sauce",
          "garlic",
          "ginger"
        ],
        price: 14,
        vegetarian: true,
        vegan: true,
        gluten_free: false,
        contains_nuts: false,
        spice_level: "medium"
      },
  
      fried_rice: {
        name: "Fried Rice",
        description:
          "Wok-fried rice with seasonal vegetables and optional egg or protein.",
        ingredients: [
          "rice",
          "peas",
          "carrots",
          "scallions",
          "soy sauce",
          "garlic",
          "ginger"
        ],
        price: 13,
        vegetarian: true,
        vegan: false,
        gluten_free: false,
        contains_nuts: false,
        spice_level: "mild"
      },
  
      dal_bhat: {
        name: "Dal Bhat",
        description:
          "Traditional Nepali plate with lentil soup, steamed rice, vegetables, and pickles.",
        ingredients: [
          "lentils",
          "rice",
          "turmeric",
          "garlic",
          "ginger",
          "seasonal vegetables"
        ],
        price: 16,
        vegetarian: true,
        vegan: true,
        gluten_free: true,
        contains_nuts: false,
        spice_level: "mild"
      },
  
      himalayan_curry: {
        name: "Himalayan Curry",
        description:
          "Slow-simmered curry with aromatic spices, available with vegetables or meat.",
        ingredients: [
          "onion",
          "tomato",
          "ginger",
          "garlic",
          "coriander",
          "turmeric",
          "chili",
          "cumin"
        ],
        price: 18,
        vegetarian: true,
        vegan: false,
        gluten_free: true,
        contains_nuts: false,
        spice_level: "medium-spicy"
      }
    },
  
    dietary_notes: {
      halal: false,
      vegan_dishes: [
        "Vegetable Chow Mein",
        "Veg Dal Bhat",
        "Vegetable Thukpa",
        "Vegetable Momo (no butter added)"
      ],
      gluten_free_dishes: ["Dal Bhat", "Himalayan Curry"]
    },
  
    catering: {
      available: true,
      info: "We offer catering for events of 10–150 guests. Please call or email for menu and pricing."
    }
  };
  