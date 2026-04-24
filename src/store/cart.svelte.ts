export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  options?: Record<string, string>;
}

class Cart {
  items = $state<CartItem[]>([]);
  isOpen = $state(false);

  get total() {
    return this.items.reduce((total, item) => total + item.price * item.quantity, 0);
  }

  get count() {
    return this.items.reduce((count, item) => count + item.quantity, 0);
  }

  add(item: CartItem) {
    const existing = this.items.find(
      (i) => i.id === item.id && JSON.stringify(i.options) === JSON.stringify(item.options)
    );
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      this.items.push(item);
    }
  }

  remove(id: string, options?: Record<string, string>) {
    this.items = this.items.filter(
      (i) => !(i.id === id && JSON.stringify(i.options) === JSON.stringify(options))
    );
  }
}

export const cart = new Cart();
