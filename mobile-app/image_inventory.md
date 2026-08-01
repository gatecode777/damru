# Damru Mobile App Image Inventory

This inventory maps all local and remote image assets used across the Damru food-ordering application.

## Remote Images

| Component / File | Image Source | Local / Remote | Current Component | Rendered Size | Cache | Placeholder | Priority |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| [FoodCard.tsx](file:///c:/Users/busin/StudioProjects/damru/mobile-app/src/components/ui/FoodCard.tsx) | `/uploads/menu/{item.image}` | Remote | Custom wrapper (`RNImage`) | 120x120 | No | None | P0 |
| [MenuProductCard.tsx](file:///c:/Users/busin/StudioProjects/damru/mobile-app/src/components/menu/MenuProductCard.tsx) | `/uploads/menu/{item.image}` | Remote | `expo-image` | 80x80 | Yes | None | P0 |
| [BranchCard.tsx](file:///c:/Users/busin/StudioProjects/damru/mobile-app/src/components/ui/BranchCard.tsx) | `/uploads/branches/{branch.image}` | Remote | Custom wrapper (`RNImage`) | Full Width | No | None | P1 |
| [BlogCard.tsx](file:///c:/Users/busin/StudioProjects/damru/mobile-app/src/components/ui/BlogCard.tsx) | `/uploads/blogs/{blog.coverImage}` | Remote | Custom wrapper (`RNImage`) | 140x90 | No | None | P1 |
| [UserProfileCard.tsx](file:///c:/Users/busin/StudioProjects/damru/mobile-app/src/components/profile/UserProfileCard.tsx) | `/uploads/users/{user.avatar}` | Remote | Custom wrapper (`RNImage`) | 60x60 | No | Initials | P1 |
| [cart.tsx](file:///c:/Users/busin/StudioProjects/damru/mobile-app/src/app/cart.tsx) | `/uploads/menu/{item.image}` | Remote | `expo-image` | 65x65 | Yes | None | P0 |
| [checkout.tsx](file:///c:/Users/busin/StudioProjects/damru/mobile-app/src/app/checkout.tsx) | `/uploads/menu/{item.image}` | Remote | `expo-image` | 50x50 | Yes | None | P0 |

---

## High-Impact Local Assets

| Asset Path | Size | Dimensions | Rendered Area | Usage | Priority |
| :--- | :---: | :---: | :--- | :--- | :---: |
| `assets/images/soupmenu.png` | **2.23 MB** | High Res | Menu Hero Background | Menu category cover | P0 |
| `assets/images/chef1.png` | **1.67 MB** | High Res | Excelent Cook Profile | Home About section | P1 |
| `assets/images/contact_hero_bg.png` | **1.30 MB** | High Res | Contact Hero Background | Contact screen header | P2 |
| `assets/images/plate1.png` | **946 KB** | High Res | Carousel item | Home hero slideshow | P0 |
| `assets/images/plate3.png` | **983 KB** | High Res | Carousel item | Home hero slideshow | P0 |
| `assets/images/plate4.png` | **902 KB** | High Res | Carousel item | Home hero slideshow | P0 |
| `assets/images/plate2.png` | **811 KB** | High Res | Carousel item | Home hero slideshow | P0 |
| `assets/images/icon.png` | **799 KB** | 1024x1024 | App Launcher Icon | Native system build | P0 |
| `assets/images/Excelentcook.png` | **721 KB** | High Res | Chef Profile | Home feature banner | P1 |
| `assets/images/ourstory.png` | **565 KB** | High Res | About Story Photo | About Us screen | P2 |
